import React from 'react';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { useRebaseStatus } from '../../../model/state/repo';
import { abortRebase } from '../../../model/actions/repo';

const StatusBarContainer = styled.div`
    background: ${(props) => props.theme.colors.conflict};
    color: ${(props) => props.theme.colors.conflictText};
    padding: 0.5rem;
    display: flex;
    flex-direction: row;
`;

export const RebaseStatusBar: React.FC = () => {
    const rebaseStatus = useRebaseStatus();
    return rebaseStatus.found ? (
        <StatusBarContainer>
            <span style={{ flex: 1 }}>This repository has a rebase operation in progress.</span>
            <StyledButton onClick={abortRebase}>Abort</StyledButton>
        </StatusBarContainer>
    ) : (
        <></>
    );
};
