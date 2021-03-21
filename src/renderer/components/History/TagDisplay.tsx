import React from 'react';
import { Tag } from '../../../model/stateObjects';
import styled from 'styled-components';

const TagLabel = styled.span`
    position: relative;
    background-color: #909090;
    color: black;
    display: inline-block;
    padding-left: 1rem;
    padding-right: 1rem;
    padding-top: 1px;
    border-radius: 2px;
    margin-right: 0.5rem;
    height: 0.9rem;
    clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
`;

export const TagDisplay: React.FC<{ tag: Tag; rail: number }> = (props) => {
    return <TagLabel>{props.tag.name}</TagLabel>;
};
