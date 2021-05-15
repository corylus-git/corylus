import React from 'react';

import { BranchInfo } from '../../../model/stateObjects';
import styled, { useTheme } from 'styled-components';

const BranchName = styled.span`
    display: inline-block;
    padding-left: 2px;
    padding-right: 2px;
    color: var(--background);
    border-radius: 2px;
    margin-right: 0.5rem;
    height: 0.9rem;
`;

export const BranchDisplay: React.FC<{ branch: BranchInfo; rail: number }> = (props) => {
    return (
        <BranchName
            style={{
                backgroundColor: `hsl(${
                    props.rail * 100
                }, 100%, calc(50% - (var(--lightness) - 50%) / 2))`,
            }}>
            {props.branch.remote ? `${props.branch.remote}/${props.branch.ref}` : props.branch.ref}
        </BranchName>
    );
};
