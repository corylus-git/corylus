import styled, { css } from 'styled-components';

export const Hoverable = css`
    :hover {
        background-color: ${(props) => props.theme.colors.highlight};
    }
`;

export const HoverableDiv = styled.div`
    ${Hoverable}
`;
