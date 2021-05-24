import React from 'react';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { CommitMetaData } from '../Diff/Commit';
import { Logger } from '../../../util/logger';
import { resolveConflict } from '../../../model/actions/repo';
import { SelectedConflict, useStagingArea } from '../../../model/state/stagingArea';
import { useRepo } from '../../../model/state/repo';

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
    align-items: top;
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
                <h2>
                    {props.conflict.theirs.type === 'commit'
                        ? 'Select our version'
                        : 'Discard patch'}
                </h2>
            </ResolutionButton>
            <ResolutionButton
                onClick={() => {
                    resolveConflict(props.conflict.file.path, 'theirs');
                    props.onClose?.();
                }}>
                <h2>
                    {' '}
                    {props.conflict.theirs.type === 'commit'
                        ? 'Select incoming version (theirs)'
                        : 'Apply patch'}
                </h2>
            </ResolutionButton>
            <div>
                <h3>Last commit:</h3>
                <CommitMetaData commit={props.conflict.ours} />
            </div>
            <div>
                {props.conflict.theirs.type === 'commit' ? (
                    <>
                        <h3>Last commit:</h3>
                        <CommitMetaData commit={props.conflict.theirs} />
                    </>
                ) : (
                    <>
                        <h3>Incoming patch</h3>
                        <p>
                            The current incoming conflict stems from a patch (e.g.{' '}
                            <code>stash apply</code>)
                        </p>
                        <p>It does not have an underlying commit.</p>
                    </>
                )}
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
