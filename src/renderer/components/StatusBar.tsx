import React from 'react';
import styled from 'styled-components';
import { useProgress } from '../../model/state/progress';

const StatusBarView = styled.div`
    border-top: 1px solid var(--border);
    text-align: right;
    padding-top: 2px;
    padding-right: 1rem;
    display: grid;
    grid-template-columns: auto 1fr 30px;
    align-items: center;
`;

export const StatusBar: React.FC = (props) => {
    const progress = useProgress();

    return (
        <StatusBarView className={progress.animate ? 'in-progress' : undefined}>
            {props.children}
            <div style={{ marginRight: '0.5rem' }}>{progress.message}</div>
        </StatusBarView>
    );
};
