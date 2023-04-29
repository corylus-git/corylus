import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { StyledButton } from '../util/StyledButton';
import MonacoEditor from 'react-monaco-editor';
import styled from 'styled-components';
import * as monaco from 'monaco-editor';
import { NoScrollPanel } from '../util/NoScrollPanel';
import { attachScrollHandlers } from '../util/scrollSync';
import { useBlameInfo } from '../../model/state/explorer';

const BlameDialogContainer = styled(StyledDialog)`
    width: 90%;
    height: 90%;
    display: grid;
    grid-template-rows: 1fr fit-content(3rem);
    > div {
        display: grid;
        grid-template-columns: 10rem 1fr;
        height: 0;
        max-height: 100%;
        min-height: 100%;
    }
`;

const BlockInfo = styled.div<{ lines: number }>`
    border-top: 1px dashed var(--border);
    font-size: 0.8rem;
    height: ${(props) => props.lines * 19 - 1}px;
    overflow: hidden;

    .author {
        white-space: nowrap;
    }
`;

export const BlameInfoDialog: React.FC = () => {
    const blameInfo = useBlameInfo();
    const editorRef = React.useRef<monaco.editor.ICodeEditor>();
    const markerRef = React.createRef<HTMLDivElement>();
    return blameInfo.found ? (
        <Modal isOpen={true}>
            <BlameDialogContainer>
                <div>
                    <NoScrollPanel ref={markerRef}>
                        {blameInfo.value.map((block, i) => (
                            <BlockInfo key={i} lines={block.content.length}>
                                <div className="author">
                                    {block.author} ({block.oid.substr(0, 8)})
                                </div>
                                {block.content.length > 1 && (
                                    <div>on {block.timestamp.toLocaleString()}</div>
                                )}
                            </BlockInfo>
                        ))}
                    </NoScrollPanel>
                    <NoScrollPanel>
                        <MonacoEditor
                            language="typescript"
                            theme="vs-dark"
                            value={blameInfo.value.map((b) => b.content.join('\n')).join('\n')}
                            options={{
                                automaticLayout: true,
                                codeLens: false,
                                contextmenu: false,
                                links: true,
                                quickSuggestions: false,
                                showUnused: false,
                                glyphMargin: true,
                                minimap: {
                                    enabled: false,
                                },
                                scrollBeyondLastLine: false,
                                readOnly: true,
                            }}
                            editorDidMount={(editor) => {
                                editorRef.current = editor;
                                attachScrollHandlers([editorRef.current], [markerRef.current]);
                            }}
                        />
                    </NoScrollPanel>
                </div>
                <StyledButton
                    onClick={() => {
                        throw Error('Not yet ported to Tauri');
                    }}>
                    Close
                </StyledButton>
            </BlameDialogContainer>
        </Modal>
    ) : (
        <></>
    );
};
