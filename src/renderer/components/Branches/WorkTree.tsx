import React from "react";
import styled from "styled-components";

const WorkTreeSpan = styled.span`
    display: inline-block;
    position: relative;
    background-color: var(--notify);
    color: var(--text-conflict);
    border-radius: 50%;
    text-align: center;
    width: 0.75rem;
    height: 0.75rem;
    margin-left: 0.5rem;
    font-size: 0.75rem;
    font-style: normal;
    font-weight: bolder;
    padding-top: 0;
    z-index: 3;
`;

export const WorkTree: React.FC<{title: string}> = props => <WorkTreeSpan title={props.title}>→</WorkTreeSpan>