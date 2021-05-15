import styled, { css } from 'styled-components';

export const Hoverable = css`
    :hover {
        background-color: var(--highlight);
    }
`;

export const HoverableDiv = styled.div`
    ${Hoverable}
`;
