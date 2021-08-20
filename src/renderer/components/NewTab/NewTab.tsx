import React, { useState } from 'react';
import styled from 'styled-components';
import InitIcon from '../icons/InitIcon.svg';
import OpenIcon from '../icons/OpenIcon.svg';
import CloneIcon from '../icons/CloneIcon.svg';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { StyledDialog } from '../util/StyledDialog';
import { StyledInput } from '../util/StyledInput';
import { ButtonGroup } from '../util/ButtonGroup';
import { appSettings } from '../../../model/settings';
import { RepositoryHistory } from './RepositoryHistory';
import { clone, init } from '../../../model/actions/repo';
import { remote } from 'electron';
import { StatusBar } from '../StatusBar';
import { tabsStore, useTabs } from '../../../model/state/tabs';

import fs from 'fs';
import path from 'path';
import { toast } from 'react-toastify';
import { trackError } from '../../../util/error-display';
import { Logger } from '../../../util/logger';
import { structuredToast } from '../../../util/structuredToast';
import { useMemo } from 'react';

const { dialog } = remote;

const NewTabView = styled.div<{ hasHistory: boolean }>`
    height: 100%;
    display: grid;
    grid-template-columns: ${(props) => (props.hasHistory ? '1fr 1fr' : '1fr')};
    align-items: center;
    justify-items: center;
`;

const RepoActionButton = styled(StyledButton)`
    height: 5rem;
    width: 60%;
    font-size: 150%;
    display: block;
    > div {
        display: grid;
        grid-template-columns: 1fr 1.5fr;
        grid-gap: 1rem;
        align-items: center;
        > :first-child {
            justify-self: right;
        }
        > :last-child {
            justify-self: start;
        }
    }
`;

const FunctionPanelView = styled.div`
    display: grid;
    grid-template-rows: 1fr 1fr 1fr;
    justify-items: center;
    align-content: center;
    height: 20rem;
    width: 100%;
`;

function FunctionPanel(props: { onClone?: () => void }) {
    const tabs = useTabs();
    return (
        <FunctionPanelView>
            <RepoActionButton
                onClick={() => {
                    const dir = dialog.showOpenDialogSync({
                        properties: ['openDirectory'],
                    });
                    dir &&
                        dir.length > 0 &&
                        init(dir[0])
                            .then((_) => tabs.openRepoInActive(dir[0]))
                            .catch((e) => {
                                Logger().error(
                                    'NewTab.init',
                                    'Could not initialize new repository',
                                    { error: e }
                                );
                                toast.error(
                                    structuredToast(
                                        'Could not initialize new repository',
                                        e.toString().split('\n')
                                    ),
                                    { autoClose: false }
                                );
                            });
                }}>
                <div>
                    <InitIcon viewBox="0 0 24 24" height="3rem" width="3rem" />
                    <span>Init new local repository</span>
                </div>
            </RepoActionButton>
            <RepoActionButton
                onClick={() => {
                    let retry = false;
                    do {
                        const dir = dialog.showOpenDialogSync({
                            properties: ['openDirectory'],
                        });
                        if (dir && dir.length > 0) {
                            if (fs.existsSync(path.join(dir[0], '.git'))) {
                                tabs.openRepoInActive(dir[0]);
                            } else {
                                dialog.showErrorBox(
                                    'Cannot open directory',
                                    `${dir} is no Git repository (.git subdirectory missing or not accessible)`
                                );
                            }
                        } else {
                            retry = false;
                        }
                    } while (retry);
                }}>
                <div>
                    <OpenIcon viewBox="0 0 24 24" height="3rem" width="3rem" />
                    <span>Open local repository</span>
                </div>
            </RepoActionButton>
            <RepoActionButton onClick={props.onClone}>
                <div>
                    <CloneIcon viewBox="0 0 24 24" height="3rem" width="3rem" />
                    <span>Clone remote repository</span>
                </div>
            </RepoActionButton>
        </FunctionPanelView>
    );
}

const CloneDialogView = styled(StyledDialog)`
    width: 40rem;
    height: 10rem;
    display: grid;
    grid-template-rows: repeat(4, 1fr);
    grid-gap: 0.5rem;
`;

const DirOpenButton = styled(StyledButton)`
    margin-left: 0.5rem;
`;

const DirectoryInput: React.FC<{
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
function getRepoBaseName(url: string): string {
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

const CloneDialog: React.FC<{ onClose: () => void }> = (props) => {
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

export const NewTab: React.FC = () => {
    const [cloneOpen, setCloneOpen] = useState(false);
    return (
        <div style={{ height: '100%' }}>
            <NewTabView hasHistory={history.length !== 0}>
                <FunctionPanel onClone={() => setCloneOpen(true)} />
                {appSettings.repositoryHistory && (
                    <RepositoryHistory
                        history={appSettings.repositoryHistory}
                        alreadyOpen={appSettings.openTabs}
                    />
                )}
            </NewTabView>
            <Modal isOpen={cloneOpen}>
                <CloneDialog onClose={() => setCloneOpen(false)} />
            </Modal>
        </div>
    );
};
