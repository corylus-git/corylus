import React, { useEffect } from 'react';
import { Route } from 'react-router-dom';
import { Actions } from './Actions';
import { HistoryPanel } from './History/HistoryPanel';
import { IndexPanel } from './Index/IndexPanel';
import { CreateBranchDialog } from './Dialogs/CreateBranchDialog';
import { DeleteBranchDialog } from './Dialogs/DeleteBranchDialog';
import { RequestMergeDialog } from './Merging/RequestMergeDialog';
import { RequestUpstreamDialog } from './Dialogs/RequestUpstreamDialog';
import { RequestFetchDialog } from './Dialogs/RequestFetchDialog';
import { RequestStashDialog } from './Dialogs/RequestStash';
import { RequestStashApplyDialog } from './Dialogs/RequestStashApplyDialog';
import { RequestStashDropDialog } from './Dialogs/RequestStashDropDialog';
import styled from 'styled-components';
import { MergeStatusBar } from './Merging/MergeStatusBar';
import { CheckoutRemoteDialog } from './Dialogs/CheckoutRemote';
import { PullDialog } from './Dialogs/PullDialog';
import { ConfigurationPanel } from './Configuration/ConfigurationPanel';
import { ManualMergePanel } from './Merging/ManualMergePanel';
import { StatusBar } from './StatusBar';
import { RequestCreateTagDialog } from './Dialogs/RequestCreateTag';
import { ExplorerPanel } from './Explore/ExplorerPanel';
import { BlameInfoDialog } from './Dialogs/BlameInfoDialog';
import { ConfigureGitFlow } from './Dialogs/ConfigureGitFlow';
import { Logger } from '../util/logger';
import { BranchResetDialog } from './Dialogs/BranchResetDialog';
import { useDialog } from '../model/state/dialogs';
import { useCurrentBranch, useRepo } from '../model/state/repo';
import { useWorkflows } from '../model/state/workflows';
import { Gitflow } from '../util/workflows/gitflow';
import { RemoteConfigurationDialog } from './Dialogs/RemoteConfigurationDialog';
import { Routes, useLocation } from 'react-router';
import { AddIgnoreListItem } from './Dialogs/AddIgnoreListItem';
import { InteractiveRebase } from './Dialogs/InteractiveRebase';
import { Rebase } from './Dialogs/Rebase';
import { AutoStashDialog } from './Dialogs/AutoStashDialog';
import { useAutoFetcher } from '../util/AutoFetcher';
import { useIndex } from '../model/state';
import { queryClient } from '../util/queryClient';

export const MainView = styled.div`
    display: grid;
    height: 100%;
    grid-template-rows: fit-content(10rem) 1fr 1.5rem;
`;

const DialogsContainer: React.FC = () => (
    <>
        <CreateBranchDialog />
        <DeleteBranchDialog />
        <RequestMergeDialog />
        <RequestUpstreamDialog />
        <RequestFetchDialog />
        <PullDialog />
        <RequestStashDialog />
        <RequestStashApplyDialog />
        <RequestStashDropDialog />
        <CheckoutRemoteDialog />
        <ManualMergePanel />
        <BranchResetDialog />
        <RequestCreateTagDialog />
        <BlameInfoDialog />
        <RemoteConfigurationDialog />
        <ConfigureGitFlow />
        <AddIgnoreListItem />
        <InteractiveRebase />
        <Rebase />
        <AutoStashDialog />
    </>
);

const CurrentBranch = styled.pre`
    margin: 0;
    padding: 0;
    padding-left: 0.5rem;
    font-size: 80%;
`;

const Detached = styled.span`
    color: var(--notify);
    font-style: italic;
    font-weight: bold;
`;

const MainStatusBar: React.FC = () => {
    const currentBranch = useCurrentBranch();
    const index = useIndex();
    return (
        <StatusBar>
            <CurrentBranch>
                {currentBranch && currentBranch.isDetached && (
                    <Detached>DETACHED HEAD: </Detached>
                )}
                {index.status.length > 0 && '*'}
                {currentBranch && currentBranch.refName}
            </CurrentBranch>
        </StatusBar>
    );
};

export const Repository: React.FC = () => {
    const repo = useRepo();
    const index = useIndex();
    const path = repo.path;
    const dialog = useDialog();
    // TODO fix
    // const __ = useDirWatcher(path);
    const _autofetcher = useAutoFetcher(repo);
    const workflows = useWorkflows();
    const location = useLocation();
    React.useEffect(() => {
        if (repo.active) {
            Logger().debug('Repository', 'Path changed', { path: path });
            repo.loadHistory();
            queryClient.invalidateQueries();
            // repo.loadRepo().then(() => {
            //     workflows.registerGitWorkflows([new Gitflow(dialog)]);
            // });
        }
    }, [path]);
    React.useEffect(() => {
        if (repo.active) {
            queryClient.invalidateQueries('index');
        }
    }, [location]);
    return (
        <MainView>
            <div>
                <MergeStatusBar />
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '4rem minmax(0,1fr)',
                    height: '100%',
                }}>
                <Actions />
                <Routes>
                    <Route path="/" element={<HistoryPanel />} />
                    <Route path="index" element={<IndexPanel />} />
                    <Route path="config" element={<ConfigurationPanel />} />
                    {/*<Route path="files" element={<ExplorerPanel />} /> */}
                </Routes>
            </div>
            <MainStatusBar />
            <DialogsContainer />
        </MainView>
    );
};
