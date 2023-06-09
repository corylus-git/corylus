import React, { useMemo, useState } from 'react';
import { StyledButton } from '../util/StyledButton';
import { StyledInput } from '../util/StyledInput';
import { ButtonGroup } from '../util/ButtonGroup';
import { clone } from '../../model/actions/repo';
import { StatusBar } from '../StatusBar';
import { tabsStore } from '../../model/state/tabs';
import * as path from '@tauri-apps/api/path';
import { toast } from 'react-toastify';
import { structuredToast } from '../../util/structuredToast';
import styled from 'styled-components';
import { StyledDialog } from '../util/StyledDialog';
import OpenIcon from '../icons/OpenIcon.svg';
import { open } from '@tauri-apps/api/dialog';

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
            autoCorrect='off'
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
            onClick={() =>
                (async () => {
                    const dir = await open({
                        title: 'Select parent directory',
                        directory: true
                    });
                    if (dir) {
                        props.onChange(Array.isArray(dir) ? dir[0] : dir);
                    }
                })()
            }>
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
    // TODO review
    // const scheme = url.match(/^[a-zA-Z0.9]+:\/\//);
    // const sshAlternateSyntaxHostPart = url.match(/^[^/]+:/);
    // if (scheme !== null || sshAlternateSyntaxHostPart !== null || path.sep === '/') {
    //     // we have an input, which is separated by /
    //     const p = path.posix.parse(url); // URLs also happen to parse as POSIX paths
    //     return p.name;
    // }
    // // we're on the only platform with another separator -> Win32
    // const p = path.win32.parse(url);
    // return p.name;
    const segments = url.split('/');
    return segments[segments.length - 1].replace(/\.git$/, '');
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
                autoCorrect='off'
                onChange={(ev) => setUrl(ev.target.value)}
            />
            <DirectoryInput dir={dir} suffix={basename} onChange={(newDir) => setDir(newDir)} />
            <StatusBar />
            <ButtonGroup>
                <StyledButton
                    onClick={async () => {
                        try {
                            await clone(url, await path.join(dir, basename))
                            tabsStore.getState().openRepoInActive(await path.join(dir, basename))
                        }
                        catch (e: any) {
                            toast.error(
                                structuredToast(
                                    `Could not clone repository from ${url} to ${await path.join(
                                        dir,
                                        basename
                                    )}`,
                                    e.toString().split('\n')
                                ),
                                { autoClose: false }
                            );
                        };
                    }}
                    disabled={!url || !dir}>
                    Clone
                </StyledButton>
                <StyledButton onClick={props.onClose}>Cancel</StyledButton>
            </ButtonGroup>
        </CloneDialogView>
    );
};
