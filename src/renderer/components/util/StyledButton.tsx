import styled from 'styled-components';

export const StyledButton = styled.button`
    background-color: ${props => props.theme.colors.background};
    border: 1px solid ${props => props.theme.colors.border};
    color: ${props => props.theme.colors.foreground};
    cursor: pointer;
    :disabled {
        color: ${props => props.theme.colors.border};
    }
    :hover {
        background-color: ${props => props.theme.colors.highlight};
    }
`;
