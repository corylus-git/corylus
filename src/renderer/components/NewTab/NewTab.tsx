import React, { useState } from 'react';
import styled from 'styled-components';
import InitIcon from '../icons/InitIcon.svg';
import OpenIcon from '../icons/OpenIcon.svg';
import CloneIcon from '../icons/CloneIcon.svg';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { appSettings } from '../../../model/settings';
import { RepositoryHistory } from './RepositoryHistory';
import { init } from '../../../model/actions/repo';
import { remote } from 'electron';
import { useTabs } from '../../../model/state/tabs';

import fs from 'fs';
import path from 'path';
import { toast } from 'react-toastify';
import { Logger } from '../../../util/logger';
import { structuredToast } from '../../../util/structuredToast';
import { CloneDialog } from './CloneDialog';

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
