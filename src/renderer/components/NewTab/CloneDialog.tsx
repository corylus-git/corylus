import React, { useMemo, useState } from 'react';
import { StyledButton } from '../util/StyledButton';
import { StyledInput } from '../util/StyledInput';
import { ButtonGroup } from '../util/ButtonGroup';
import { clone } from '../../../model/actions/repo';
import { StatusBar } from '../StatusBar';
import { tabsStore } from '../../../model/state/tabs';
import path from 'path';
import { toast } from 'react-toastify';
import { structuredToast } from '../../../util/structuredToast';
import styled from 'styled-components';
import { StyledDialog } from '../util/StyledDialog';
import { dialog } from 'electron';
import OpenIcon from '../icons/OpenIcon.svg';

export const CloneDialogView = styled(StyledDialog)`
    width: 40rem;
    height: 10rem;
    display: grid;
    grid-template-rows: repeat(4, 1fr);
    grid-gap: 0.5rem;
`;

const DirOpenButton = styled(StyledButton)`
    margin-left: 0.5rem;
`;

export const DirectoryInput: React.FC<{
    dir: string;
    onChange: (dir: string) => void;
    suffix: string;
}> = (props) => (
    <div style={{ display: 'flex', flexDirection: 'row', alignContent: 'center' }}>
        <StyledInput
            style={{ flexGrow: 1 }}
            type="text"
            placeholder="Local directory"
            value={props.dir}
            onChange={(ev) => props.onChange(ev.target.value)}
        />
        <div
            style={{
                marginTop: 'auto',
                marginBottom: 'auto',
            }}>
            {path.sep}
            {props.suffix}
        </div>
        <DirOpenButton
            onClick={() => {
                const dir = dialog.showOpenDialogSync({
                    properties: ['openDirectory', 'promptToCreate'],
                });
                dir && dir.length > 0 && props.onChange(dir[0]);
            }}>
            <OpenIcon />
        </DirOpenButton>
    </div>
);

/**
 * Determine the base name of a repository, i.e. the last "path" part to enable
 * sub-dir creation based on the remote name.
 *
 * @param url The URL of the repository to determine the base name for
 */
export function getRepoBaseName(url: string): string {
    const scheme = url.match(/^[a-zA-Z0.9]+:\/\//);
    const sshAlternateSyntaxHostPart = url.match(/^[^/]+:/);
    if (scheme !== null || sshAlternateSyntaxHostPart !== null || path.sep === '/') {
        // we have an input, which is separated by /
        const p = path.posix.parse(url); // URLs also happen to parse as POSIX paths
        return p.name;
    }
    // we're on the only platform with another separator -> Win32
    const p = path.win32.parse(url);
    return p.name;
}

export const CloneDialog: React.FC<{ onClose: () => void }> = (props) => {
    const [url, setUrl] = useState<string>('');
    const [dir, setDir] = useState<string>('');
    const basename = useMemo(() => getRepoBaseName(url), [url]);
    return (
        <CloneDialogView>
            <StyledInput
                type="text"
                placeholder="Repository URL"
                onChange={(ev) => setUrl(ev.target.value)}
            />
            <DirectoryInput dir={dir} suffix={basename} onChange={(newDir) => setDir(newDir)} />
            <StatusBar />
            <ButtonGroup>
                <StyledButton
                    onClick={() => {
                        clone(url, path.join(dir, basename))
                            .then((_) =>
                                tabsStore.getState().openRepoInActive(path.join(dir, basename))
                            )
                            .catch((e) => {
                                toast.error(
                                    structuredToast(
                                        `Could not clone repository from ${url} to ${path.join(
                                            dir,
                                            basename
                                        )}`,
                                        e.toString().split('\n')
                                    ),
                                    { autoClose: false }
                                );
                            });
                    }}
                    disabled={!url || !dir}>
                    Clone
                </StyledButton>
                <StyledButton onClick={props.onClose}>Cancel</StyledButton>
            </ButtonGroup>
        </CloneDialogView>
    );
};
