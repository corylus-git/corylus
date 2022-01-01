import React from 'react';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { abortMerge, abortRebase } from '../../../model/actions/repo';
import { useConflicts, useRebaseStatus } from '../../../model/state/repo';

const MergeStatusBarContainer = styled.div`
    background: var(--conflict);
    color: var(--conflict-text);
    padding: 0.5rem;
    display: flex;
    flex-direction: row;
`;

export const MergeStatusBar: React.FunctionComponent = () => {
    const hasConflicts = useConflicts();
    const isRebase = useRebaseStatus();

    const statusText = isRebase.found
        ? 'This repository has a rebase operation in progress. Abort?'
        : 'The repository has merge conflicts pending. Please resolve the conflicts or abort the merge.';

    return hasConflicts ? (
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
