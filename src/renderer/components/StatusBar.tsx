import React from 'react';
import styled from 'styled-components';
import { RunningIndicator } from './util/RunningIndicator';
import { useProgress } from '../../model/state/progress';
import { useCurrentBranch, useStatus } from '../../model/state/repo';

const StatusBarView = styled.div`
    border-top: 1px solid var(--border);
    text-align: right;
    padding-top: 2px;
    padding-right: 1rem;
    display: grid;
    grid-template-columns: auto 1fr 30px;
    align-items: center;
`;

const CurrentBranch = styled.pre`
    margin: 0;
    padding: 0;
    padding-left: 0.5rem;
    font-size: 80%;
`;

const Detached = styled.span`
    color: var(--notify);
    font-style: italic;
    font-weight: bold;
`;

export const StatusBar: React.FC = () => {
    const progress = useProgress();
    const currentBranch = useCurrentBranch();
    const status = useStatus();

    return (
        <StatusBarView>
            <CurrentBranch>
                {currentBranch.found && currentBranch.value.isDetached && (
                    <Detached>DETACHED HEAD: </Detached>
                )}
                {status.length > 0 && '*'}
                {currentBranch.found && currentBranch.value.ref}
            </CurrentBranch>
            <div style={{ marginRight: '0.5rem' }}>{progress.message}</div>
            <RunningIndicator active={progress.animate} />
        </StatusBarView>
    );
};
