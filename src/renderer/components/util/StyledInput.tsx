import styled from 'styled-components';

export const StyledInput = styled.input`
    border: 1px solid var(--border);
    background-color: var(--input);
    color: var(--foreground);
    ::placeholder {
        color: var(--border);
    }
`;
