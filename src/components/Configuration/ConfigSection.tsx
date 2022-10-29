import styled from 'styled-components';
import React from 'react';

const ConfigSectionContainer = styled.div`
    border: 1px solid var(--border);
    margin: 0.5rem;
    margin-top: 1rem;
    position: relative;
    padding: 1rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 0.25rem;
    width: 40%;
`;

const ConfigSectionTitle = styled.span`
    background-color: var(--background);
    display: inline-block;
    padding: 0 0.5rem;
    position: absolute;
    top: -0.5rem;
    left: 1rem;
`;

export const ConfigSection: React.FC<{ title?: string }> = (props) => {
    return (
        <ConfigSectionContainer>
            {props.title && <ConfigSectionTitle>{props.title}</ConfigSectionTitle>}
            {props.children}
        </ConfigSectionContainer>
    );
};
