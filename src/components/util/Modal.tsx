import React, { Props } from 'react';
import styled from 'styled-components';

const ModalView = styled.div`
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: grid;
    align-items: center;
    justify-items: center;
    grid-template-rows: 1fr;
    background-color: rgba(0, 0, 0, 0.5);
`;

export function Modal(props: { isOpen: boolean } & React.ComponentProps<'div'>) {
    return props.isOpen ? <ModalView>{props.children}</ModalView> : <></>;
}
