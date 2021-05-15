import styled from 'styled-components';

export const StyledButton = styled.button`
    background-color: var(--background);
    border: 1px solid var(--border);
    color: var(--foreground);
    cursor: pointer;
    :disabled {
        color: var(--border);
    }
    :hover {
        background-color: var(--highlight);
    }
`;
