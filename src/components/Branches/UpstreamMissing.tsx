import styled from "styled-components";

export const UpstreamMissing = styled.span`
    display: inline-block;
    position: absolute;
    left: 0;
    bottom: 0.15rem;
    background-color: var(--conflict);
    color: var(--conflict-text);
    border-radius: 50%;
    text-align: center;
    width: 0.5rem;
    height: 0.5rem;
    font-size: 0.5rem;
    z-index: 3;
`;
