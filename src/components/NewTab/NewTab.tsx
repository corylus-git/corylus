import React, { useState } from 'react';
import styled from 'styled-components';
import { open, message } from '@tauri-apps/api/dialog';
import InitIcon from '../icons/InitIcon.svg';
import OpenIcon from '../icons/OpenIcon.svg';
import CloneIcon from '../icons/CloneIcon.svg';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { appSettings } from '../../model/settings';
import { RepositoryHistory } from './RepositoryHistory';
import { init } from '../../model/actions/repo';
import { useTabs, TabsActions } from '../../model/state/tabs';

import { toast } from 'react-toastify';
import { Logger } from '../../util/logger';
import { structuredToast } from '../../util/structuredToast';
import { CloneDialog } from './CloneDialog';
import { invoke } from '@tauri-apps/api';
import { useQuery } from 'react-query';

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

async function initRepo(tabs: TabsActions) {
    const dir = await open({
        title: 'Select empty directory',
        directory: true
    });
    if (dir && !Array.isArray(dir)) {
        try {
            await init(dir);
            tabs.openRepoInActive(dir)
        }
        catch (e: any) {
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
        }
    }
}

async function openRepo(tabs: TabsActions) {
    let retry = false;
    do {
        const dir = await open({
            title: 'Select existing Git directory',
            directory: true
        });
        if (dir && !Array.isArray(dir)) {
            if (await invoke('is_git_dir', { name: dir })) {
                tabs.openRepoInActive(dir);
                retry = false;
            } else {
                await message(
                    `${dir} is no Git repository (.git missing or not accessible)`,
                    { title: 'Cannot open directory', type: 'error' }
                );
                retry = true;
            }
        } else {
            retry = false;
        }
    } while (retry);
}

function FunctionPanel(props: { onClone?: () => void }) {
    const tabs = useTabs();
    return (
        <FunctionPanelView>
            <RepoActionButton onClick={() => initRepo(tabs)}>
                <div>
                    <InitIcon viewBox="0 0 24 24" style={{ height: "3rem",  width: "3rem"}} />
                    <span>Init new local repository</span>
                </div>
            </RepoActionButton>
            <RepoActionButton
                onClick={() => openRepo(tabs)}>
                <div>
                    <OpenIcon viewBox="0 0 24 24" style={{ height: "3rem", width: "3rem" }} />
                    <span>Open local repository</span>
                </div>
            </RepoActionButton>
            <RepoActionButton onClick={props.onClone}>
                <div>
                    <CloneIcon viewBox="0 0 24 24" style={{ height: "3rem", width: "3rem" }} />
                    <span>Clone remote repository</span>
                </div>
            </RepoActionButton>
        </FunctionPanelView>
    );
}

export const NewTab: React.FC = () => {
    const [cloneOpen, setCloneOpen] = useState(false);
    const {isLoading, error, data} = useQuery("", appSettings)
    if (isLoading) {
        return <div>Initializing...</div>
    }
    if (error) {
        return <div>Something really broke...</div>
    }
    if (data) {
        const settings = data;
        console.log("Settings", settings);        
        return (
            <div style={{ height: '100%' }}>
                <NewTabView hasHistory={history.length !== 0}>
                    <FunctionPanel onClone={() => setCloneOpen(true)} />
                    {settings.repositoryHistory && (
                        <RepositoryHistory
                            history={settings.repositoryHistory}
                            alreadyOpen={settings.openTabs}
                        />
                    )}
                </NewTabView>
                <Modal isOpen={cloneOpen}>
                    <CloneDialog onClose={() => setCloneOpen(false)} />
                </Modal>
            </div>
        );
    }
    return <div>Internal error. No settings found.</div>
};
