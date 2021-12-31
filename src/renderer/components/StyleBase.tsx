import styled, { css } from 'styled-components';

export const Hoverable = css`
    :hover {
        background-color: var(--highlight);
    }
`;

export const HoverableDiv = styled.div`
    ${Hoverable}
`;

export const DropDownList = styled.select`
    border: 1px solid (--border);
    background-color: var(--background);
    color: var(--foreground);
`;
