import styled from 'styled-components';

export const ButtonGroup = styled.div<{ children: JSX.Element[] | JSX.Element }>`
    display: grid;
    grid-template-columns: repeat(${props => (props.children as JSX.Element[])?.length ?? 1}, 1fr);
    grid-gap: 1rem;
    margin-top: 1rem;
`;
