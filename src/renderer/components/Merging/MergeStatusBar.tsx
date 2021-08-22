import React from 'react';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { abortMerge } from '../../../model/actions/repo';
import { useConflicts } from '../../../model/state/repo';

const MergeStatusBarContainer = styled.div`
    background: var(--conflict);
    color: var(--conflict-text);
    padding: 0.5rem;
    display: flex;
    flex-direction: row;
`;

export const MergeStatusBar: React.FunctionComponent = () => {
    const hasConflicts = useConflicts();
    return hasConflicts ? (
        <MergeStatusBarContainer>
            <span style={{ flex: 1 }}>
                The repository has merge conflicts pending. Please resolve the conflicts or abort
                the merge.
            </span>
            <StyledButton onClick={() => abortMerge()}>Abort merge</StyledButton>
        </MergeStatusBarContainer>
    ) : (
        <></>
    );
};
