import { Modal } from './util/Modal';
import React from 'react';
import { StyledDialog } from './util/StyledDialog';
import { remote } from 'electron';
import { StyledButton } from './util/StyledButton';
import styled from 'styled-components';

const { app } = remote;

const AboutLink = styled.a`
    color: ${(props) => props.theme.colors.foreground};
`;

export const AboutPanel: React.FC<{ open: boolean; onClose: () => void }> = (props) => {
    return props.open ? (
        <Modal isOpen>
            <StyledDialog>
                <h1>Corylus {app.getVersion()}</h1>
                <p>
                    Copyright © 2020-present Markus Brückner &lt;
                    <AboutLink href="mailto:corylus@corylus.dev">corylus@corylus.dev</AboutLink>&gt;
                </p>
                <pre>
                    This program is free software: you can redistribute it and/or modify it under
                    <br />
                    the terms of the GNU General Public License version 3 as published by the Free
                    <br />
                    Software Foundation.
                </pre>
                <pre>
                    This program is distributed in the hope that it will be useful, but WITHOUT ANY
                    <br />
                    WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
                    <br />
                    PARTICULAR PURPOSE. See the GNU General Public License for more details at
                    <br />
                    <a href="https://www.gnu.org/licenses/">https://www.gnu.org/licenses/</a>.
                </pre>
                <StyledButton onClick={props.onClose}>Close</StyledButton>
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
