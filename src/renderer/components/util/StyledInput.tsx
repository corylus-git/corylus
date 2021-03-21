import styled from 'styled-components';

export const StyledInput = styled.input`
    border: 1px solid ${props => props.theme.colors.border};
    background-color: ${props => props.theme.colors.input};
    color: ${props => props.theme.colors.foreground};
    ::placeholder {
        color: ${props => props.theme.colors.border};
    }
`;
