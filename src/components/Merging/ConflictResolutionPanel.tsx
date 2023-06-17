import React from 'react';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { CommitMetaData } from '../Diff/Commit';
import { Logger } from '../../util/logger';
import { resolveConflict } from '../../model/actions/repo';
import { SelectedConflict, useStagingArea } from '../../model/state/stagingArea';
import { useHead, useMergeHead, useRepo } from '../../model/state/repo';
import { invoke } from '@tauri-apps/api';

export interface ConflictResolutionPanelProps {
    path: string;
    ourType: 'commit' | 'stash';
    theirType: 'commit' | 'stash';
    onClose?: () => void;
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
    const ours = useHead();
    const theirs = useMergeHead();
    const stagingArea = useStagingArea();

    React.useEffect(() => {
        invoke('get_conflicts', {});
    });

    if (ours.isFetching || theirs.isFetching) {
        return <>Loading conflicting commits...</>
    }

    if (ours.error || theirs.error) {
        return <>Something broke loading commit information...</>
    }

    if (ours.data && theirs.data) {
        return (
            <ConflictResolutionDisplay>
                <h1 className="full">{props.path}</h1>
                <div className="full">This file has incompatible changes in the merged commits.</div>
                <ResolutionButton
                    onClick={() => {
                        resolveConflict(props.path, 'ours');
                        props.onClose?.();
                    }}>
                    <h2>
                        {ours.data.type === 'commit'
                            ? 'Select our version'
                            : 'Discard patch'}
                    </h2>
                </ResolutionButton>
                <ResolutionButton
                    onClick={() => {
                        resolveConflict(props.path, 'theirs');
                        props.onClose?.();
                    }}>
                    <h2>
                        {theirs.data.type === 'commit'
                            ? 'Select incoming version (theirs)'
                            : 'Apply patch'}
                    </h2>
                </ResolutionButton>
                <div>
                    <h3>Last commit:</h3>
                    {<CommitMetaData commit={ours.data} />}
                </div>
                <div>
                    {theirs.data.type === 'commit' ? (
                        <>
                            <h3>Last commit:</h3>
                            <CommitMetaData commit={theirs.data} />
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
                        stagingArea.requestManualMerge(props.path);
                    }}>
                    <h2>Merge file manually</h2>
                </ResolutionButton>
            </ConflictResolutionDisplay>
        );
    }

    return <>Internal error</>;
};
