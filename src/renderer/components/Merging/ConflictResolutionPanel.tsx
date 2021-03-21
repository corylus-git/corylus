import React from 'react';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { CommitMetaData } from '../Diff/Commit';
import { Logger } from '../../../util/logger';
import { resolveConflict } from '../../../model/actions/repo';
import { SelectedConflict, useStagingArea } from '../../../model/state/stagingArea';

export interface ConflictResolutionPanelProps {
    onClose?: () => void;
    conflict: SelectedConflict;
}

const ConflictResolutionDisplay = styled.div`
    width: 1fr;
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 1rem;
    align-items: center;
    justify-items: center;
    padding-left: 2rem;
    padding-right: 2rem;
    .full {
        grid-column: 1/3;
        text-align: center;
    }
`;

const ResolutionButton = styled(StyledButton)`
    width: 25rem;
    margin-top: 5rem;
`;

export const ConflictResolutionPanel: React.FC<ConflictResolutionPanelProps> = (props) => {
    const stagingArea = useStagingArea();
    return (
        <ConflictResolutionDisplay>
            <h1 className="full">{props.conflict.file.path}</h1>
            <div className="full">This file has incompatible changes in the merged commits.</div>
            <ResolutionButton
                onClick={() => {
                    resolveConflict(props.conflict.file.path, 'ours');
                    props.onClose?.();
                }}>
                <h2>Select our version</h2>
            </ResolutionButton>
            <ResolutionButton
                onClick={() => {
                    resolveConflict(props.conflict.file.path, 'theirs');
                    props.onClose?.();
                }}>
                <h2>Select incoming version (theirs)</h2>
            </ResolutionButton>
            <div>
                <h3>Last commit:</h3>
                <CommitMetaData commit={props.conflict.ours} />
            </div>
            <div>
                <h3>Last commit:</h3>
                <CommitMetaData commit={props.conflict.theirs} />
            </div>
            <ResolutionButton
                className="full"
                onClick={() => {
                    Logger().silly('ConflictResolutionPanel', 'Requesting manual merge');
                    stagingArea.requestManualMerge(props.conflict.file.path);
                }}>
                <h2>Merge file manually</h2>
            </ResolutionButton>
        </ConflictResolutionDisplay>
    );
};
