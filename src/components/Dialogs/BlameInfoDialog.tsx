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
import { ModalDialog } from './ModalDialog';
import { useDialog } from '../../model/state/dialogs';
import { RunningIndicator } from '../util/RunningIndicator';
import { formatTimestamp } from '../../model/stateObjects';
import { selectCommit } from '../../model/actions/repo';
import { useNavigate } from 'react-router';
import { Link } from 'react-router-dom';

const BlameDialogContainer = styled(StyledDialog)`
    width: 90vw;
    height: 90vh;
    display: grid;
    grid-template-rows: 1fr fit-content(3rem);
    > div {
        display: grid;
        grid-template-columns: 11rem 1fr;
        height: 0;
        max-height: 100%;
        min-height: 100%;
    }
`;

const BlockInfo = styled.div<{ lines: number }>`
    border-top: 1px dashed var(--border);
    font-size: 0.8rem;
    height: ${(props) => props.lines * 19 - 1}px;
    overflow-block: hidden;

    .author {
        white-space: nowrap;
    }
`;

export type BlameInfoProps = {
    path: string;
}

const BlameInfoDisplay: React.FC<BlameInfoProps> = (props) => {
    const blameInfo = useBlameInfo(props.path);
    const dialog = useDialog();
    const editorRef = React.useRef<monaco.editor.ICodeEditor>();
    const markerRef = React.createRef<HTMLDivElement>();

    if (blameInfo.isLoading) {
        return <div className='in-progress'>Loading blame info for {props.path}...</div>;
    }

    if (blameInfo.isError) {
        return <div>{`${blameInfo.error}`}</div>
    }

    return blameInfo.data ? (
        <BlameDialogContainer>
            <div>
                <NoScrollPanel ref={markerRef}>
                    {blameInfo.data.map((block, i) => (
                        <BlockInfo key={i} lines={block.content.length}>
                            <div className="author">
                                {block.author} (<Link to="/" onClick={(e) => {
                                    selectCommit(block.oid);
                                    dialog.close();
                                }}>{block.short_oid}</Link>)
                            </div>
                            {block.content.length > 1 && (
                                <div>on {formatTimestamp(block.timestamp)}</div>
                            )}
                        </BlockInfo>
                    ))}
                </NoScrollPanel>
                <NoScrollPanel>
                    <MonacoEditor
                        language="typescript"
                        theme="vs-dark"
                        value={blameInfo.data.map((b) => b.content.join('\n')).join('\n')}
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
        </BlameDialogContainer>
    ) : (
        <></>
    );
};


export const BlameInfoDialog: React.FC = () => {
    const dialog = useDialog();

    return (
        <ModalDialog for="blame-info-dialog">
            {
                dialog.type === 'blame-info-dialog' && (
                    <BlameInfoDisplay path={dialog.path} />
                )
            }
            <StyledButton
                onClick={() => dialog.close()}>
                Close
            </StyledButton>

        </ModalDialog>
    )
}