import React from 'react';
import styled from 'styled-components';
import { RunningIndicator } from './util/RunningIndicator';
import { useProgress } from '../../model/state/progress';
import { useCurrentBranch } from '../../model/state/repo';

const StatusBarView = styled.div`
    border-top: 1px solid ${(props) => props.theme.colors.border};
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

export const StatusBar: React.FC = () => {
    const progress = useProgress();
    const currentBranch = useCurrentBranch();

    return (
        <StatusBarView>
            <CurrentBranch>{currentBranch.found && currentBranch.value.ref}</CurrentBranch>
            <div style={{ marginRight: '0.5rem' }}>{progress.message}</div>
            <RunningIndicator active={progress.animate} />
        </StatusBarView>
    );
};
