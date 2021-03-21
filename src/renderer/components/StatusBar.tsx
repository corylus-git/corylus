import React from 'react';
import styled from 'styled-components';
import { RunningIndicator } from './util/RunningIndicator';
import { useProgress } from '../../model/state/progress';

const StatusBarView = styled.div`
    border-top: 1px solid ${(props) => props.theme.colors.border};
    text-align: right;
    padding-top: 2px;
    padding-right: 1rem;
    display: grid;
    grid-template-columns: 1fr 30px;
`;

export const StatusBar: React.FC = () => {
    const progress = useProgress();

    return (
        <StatusBarView>
            <div style={{ marginRight: '0.5rem' }}>{progress.message}</div>
            <RunningIndicator active={progress.animate} />
        </StatusBarView>
    );
};
