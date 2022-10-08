import styled from "styled-components";

export const SectionHeader = styled.div`
    position: relative;
    font-size: 1rem;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background-color: var(--highlight);
    margin-left: 5px;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    padding-left: 0.5rem;
    padding-top: 0.1rem;

    .add_remote {
        border-top-width: 0;
        border-bottom-width: 0;
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        background-color: unset;

        :hover {
            background-color: var(--background);
        }
    }
`;
