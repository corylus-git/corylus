import React from 'react';
import styled from 'styled-components';
import ConflictIcon from '../icons/ConflictIcon.svg';
import { DiffStatus } from '../../../model/stateObjects';

const StatusIcon = styled.span<{ color: string }>`
    font-weight: bold;
    display: inline-block;
    border-radius: 50%;
    width: 1.2em;
    height: 1.2em;
    color: black;
    text-align: center;
    padding-top: 0.1rem;
    box-sizing: border-box;
    background-color: ${(props) => props.color};
`;

export function FileStatus(props: {
    isConflicted?: boolean;
    status: DiffStatus;
    style?: React.CSSProperties;
}) {
    if (props.isConflicted) {
        // conflicted files are marked separately because their change does not come into play
        return <ConflictIcon viewBox="0 0 24 24" width="1.2rem" height="1.2rem" />;
    }
    switch (props.status) {
        case 'added':
            return <StatusIcon color="#00A000">+</StatusIcon>;
        case 'modified':
            return <StatusIcon color="#C0A000">M</StatusIcon>;
        case 'renamed':
            return <StatusIcon color="#A0A0FF">R</StatusIcon>;
        case 'deleted':
            return <StatusIcon color="#FF5050">-</StatusIcon>;
        case 'untracked':
            return <StatusIcon color="#A0A0A0">?</StatusIcon>;
        case 'unknown':
            return <StatusIcon color="#000000">⌁</StatusIcon>;
        default:
            return <span></span>;
    }
}
