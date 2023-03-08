import React from 'react';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { abortMerge, abortRebase } from '../../model/actions/repo';
import { useMergeStatus, useRebaseStatus } from '../../model/state/repo';

const MergeStatusBarContainer = styled.div`
    background: var(--conflict);
    color: var(--conflict-text);
    padding: 0.5rem;
    display: flex;
    flex-direction: row;
`;

export const MergeStatusBar: React.FunctionComponent = () => {
    const isMerge = useMergeStatus();
    const isRebase = useRebaseStatus();

    const statusText = isRebase.found
        ? 'This repository has a rebase operation in progress. Continue or abort?'
        : 'The repository has a merge operation pending. Continue or abort?.';

    return isMerge|| isRebase.found ? (
        <MergeStatusBarContainer>
            <span style={{ flex: 1 }}>{statusText}</span>
            <StyledButton onClick={() => (isRebase.found ? abortRebase() : abortMerge())}>
                {isRebase.found ? 'Abort rebase' : 'Abort merge'}
            </StyledButton>
        </MergeStatusBarContainer>
    ) : (
        <></>
    );
};
