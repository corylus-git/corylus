import styled from 'styled-components';

export const StyledDialog = styled.div`
    border: 1px solid ${props => props.theme.colors.border};
    background-color: ${props => props.theme.colors.background};
    padding: 1rem;
    grid-gap: 0.5rem;
`;
