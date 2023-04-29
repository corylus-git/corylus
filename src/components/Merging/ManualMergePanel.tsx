import React from 'react';
import styled from 'styled-components';
import monaco from 'monaco-editor';
import { Splitter } from '../util/Splitter';
import { ConflictedSourcesDisplay } from './ConflictedSourcesDisplay';
import { Modal } from '../util/Modal';
import { Logger } from '../../util/logger';

import { EditorContainer } from './EditorContainer';
import { StyledButton } from '../util/StyledButton';
import { Maybe, nothing, just } from '../../util/maybe';
import { saveManualMerge } from '../../model/actions/repo';
import { useStagingArea } from '../../model/state/stagingArea';
import { IConflictBlock } from './util/blocks';

const ManualMergeViewContainer = styled.div`
    z-index: 20;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--background);
    display: grid;
    grid-template-rows: 1fr 2rem;
`;

const ButtonContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr fit-content(10rem);
    grid-column-gap: 1rem;
    align-items: center;
    justify-items: right;
    border-top: 1px solid var(--border);
    padding-right: 1rem;
`;

export interface ManualMergePanelProps {
    onSave: (result: string) => void;
}

export const ManualMergePanel: React.FC = () => {
    const stagingArea = useStagingArea((s) => s);
    const [code, setCode] = React.useState<Maybe<string>>(nothing);
    const mergeEditorRef = React.useRef<monaco.editor.ICodeEditor>();

    if (stagingArea.manualMerge.found) {
        const p = stagingArea.manualMerge.value.path;
        const mimeType = /* mime.lookup(p) || */'text/plain';
        return (
            <Modal isOpen={true}>
                <ManualMergeViewContainer>
                    <Splitter horizontal initialPosition="1.5fr">
                        <ConflictedSourcesDisplay
                            blocks={stagingArea.manualMerge.value.blocks}
                            onToggleBlock={(side, index) => {
                                stagingArea.toggleBlock(side, index);
                            }}
                            onScroll={(t) => mergeEditorRef.current?.setScrollTop(t)}
                            type={mimeType}
                        />
                        <EditorContainer
                            blocks={stagingArea.manualMerge.value.blocks}
                            onChange={(content) => {
                                Logger().debug('ManualMergePanel', 'Editor notified code update', {
                                    content: content,
                                });
                                setCode(just(content));
                            }}
                            editorMounted={(editor) => (mergeEditorRef.current = editor)}
                            type={mimeType}
                        />
                    </Splitter>
                    <ButtonContainer>
                        <StyledButton
                            style={{ width: '10rem' }}
                            onClick={() => {
                                saveManualMerge(p, (code.found && code.value) || '');
                                stagingArea.finishManualMerge();
                            }}
                            disabled={
                                code.found &&
                                stagingArea.manualMerge.value.blocks.some(
                                    (b) => b.isConflict && !b.oursSelected && !b.theirsSelected
                                )
                            }>
                            Resolve
                        </StyledButton>
                        <StyledButton
                            style={{ width: '10rem' }}
                            onClick={() => {
                                stagingArea.finishManualMerge();
                            }}>
                            Cancel
                        </StyledButton>
                    </ButtonContainer>
                </ManualMergeViewContainer>
            </Modal>
        );
    }
    return <></>;
};
