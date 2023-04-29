import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import styled from 'styled-components';

import '../style/app.css';
import BranchIcon from './icons/BranchIcon.svg';
import MergeIcon from './icons/MergeIcon.svg';
import FetchIcon from './icons/FetchIcon.svg';
import PullIcon from './icons/PullIcon.svg';
import PushIcon from './icons/PushIcon.svg';
import IndexIcon from './icons/IndexIcon.svg';
import HistoryIcon from './icons/HistoryIcon.svg';
import StashIcon from './icons/StashIcon.svg';
import SettingsIcon from './icons/SettingsIcon.svg';
import ExploreIcon from './icons/ExploreIcon.svg';
import { Hoverable } from './StyleBase';
import { Logger } from '../util/logger';
import { fetchRemote, push } from '../model/actions/repo';
import { nothing, just, fromNullable } from '../util/maybe';
import { useDialog } from '../model/state/dialogs';
import { useCurrentBranch, useRemotes } from '../model/state/repo';
import { useWorkflows } from '../model/state/workflows';
import { useIndex } from '../model/state';

const ActionButton = styled.button<{ active?: boolean } & React.HTMLProps<HTMLButtonElement>>`
    ${Hoverable}
    width: 100%;
    border: 0;
    padding: 0;
    box-sizing: border-box;
    background-color: ${(props) => (props.active ? 'var(--highlight)' : 'var(--background)')};
    position: relative;
    color: var(--foreground);
    :focus {
        border: 1px solid var(--foreground);
        outline: none;
    }
`;

function RouteAction(props: {
    children: JSX.Element | JSX.Element[];
    route: string;
    title?: string;
}) {
    const navigate = useNavigate();
    const location = useLocation();
    return (
        <ActionButton
            active={location.pathname === props.route}
            onClick={() => {
                if (location.pathname !== props.route) {
                    navigate(props.route);
                }
            }}
            title={props.title}>
            {props.children}
        </ActionButton>
    );
}

const ActionsContainer = styled.div`
    border-right: 1px solid var(--border);
    display: grid;
    grid-template-rows: repeat(10, fit-content(3rem)) 1fr fit-content(3rem);
`;

const WorkflowButton = styled.button`
    ${Hoverable}
    z-index: 10;
    font-size: 60%;
    position: absolute;
    display: block;
    bottom: 0.1rem;
    right: 0.3rem;
    width: 1rem;
    height: 1rem;
    color: var(--foreground);
    background-color: var(--background);
    border: 0;
`;

const ModificationIcon = styled.div`
    font-size: 80%;
    position: absolute;
    bottom: 0.1rem;
    right: 0.3rem;
    min-width: 1rem;
    background-color: var(--notify);
    color: var(--background);
    border-radius: 0.5rem;
    text-align: center;
    padding-top: 0.05rem;
    padding-left: 0.1rem;
    padding-right: 0.15rem;
`;

function ModifificationCounter() {
    const { data: index } = useIndex();
    Logger().silly('ModificationCounter', 'Status', { status: index });
    return index !== undefined && index.length ? <ModificationIcon>{index?.length}</ModificationIcon> : <></>;
}

const BranchButtonContainer = styled.div`
    position: relative;
`;

const BranchButton: React.FC = () => {
    const workflows = useWorkflows();
    const dialog = useDialog();

    return (
        <BranchButtonContainer>
            <ActionButton
                onClick={() =>
                    dialog.open({
                        type: 'request-new-branch',
                        subType: 'none',
                        source: nothing,
                        branchPrefix: nothing,
                    })
                }
                title="Create a new branch">
                <BranchIcon viewBox="0 0 24 24" width="100%" height="100%" />
            </ActionButton>
            <WorkflowButton
                onClick={() => {
                    // TODO
                    // const menu = workflows.workflows.some((wf) => wf.isConfigured)
                    //     ? Menu.buildFromTemplate(
                    //           workflows.workflows.find((wf) => wf.isConfigured)!.currentMenu()
                    //       )
                    //     : Menu.buildFromTemplate(
                    //           workflows.workflows.flatMap((wf) => wf.currentMenu())
                    //       );
                    // menu.popup({ window: getCurrentWindow() });
                }}>
                ◢
            </WorkflowButton>
        </BranchButtonContainer>
    );
};

export const Actions: React.FC = () => {
    const currentBranch = useCurrentBranch();
    const dialog = useDialog();
    const remotes = useRemotes()

    if (remotes.data !== undefined && currentBranch.data !== undefined) {
        return (
            <ActionsContainer>
                <RouteAction route="/" title="View the commit history">
                    <HistoryIcon viewBox="0 0 24 24" width="100%" height="100%" />
                </RouteAction>
                <RouteAction route="/index" title="Staging area">
                    <IndexIcon viewBox="0 0 24 24" width="100%" height="100%" />
                    <ModifificationCounter />
                </RouteAction>
                <RouteAction route="/files" title="Explore the working directory">
                    <ExploreIcon viewBox="0 0 24 24" width="100%" height="100%" />
                </RouteAction>
                <div style={{ height: '1rem' }}></div>
                <BranchButton />
                <ActionButton
                    onClick={() => {
                        if (currentBranch) {
                            dialog.open({
                                type: 'request-merge',
                                source: fromNullable(currentBranch.data?.refName),
                            });
                        }
                    }}
                    title="Merge into current branch">
                    <MergeIcon viewBox="0 0 24 24" width="100%" height="100%" />
                </ActionButton>
                <ActionButton
                    onClick={() => {
                        if (remotes.data?.length === 0) {
                            dialog.open({
                                type: 'remote-configuration', remote: nothing,
                                onConfirm: () => dialog.open({
                                    type: 'fetch-dialog'
                                })
                            })
                        }
                        else {
                            dialog.open({ type: 'fetch-dialog' })
                        }
                    }}
                    title="Fetch remote repositories">
                    <FetchIcon viewBox="0 0 24 24" width="100%" height="100%" />
                </ActionButton>
                <ActionButton
                    onClick={() => {
                        if (remotes.data?.length === 0) {
                            dialog.open({
                                type: 'remote-configuration', remote: nothing,
                                onConfirm: () => dialog.open({
                                    type: 'fetch-dialog',
                                    onConfirm: () => dialog.open({ type: 'request-pull' }),
                                })
                            });
                        }
                        else {
                            dialog.open({ type: 'request-pull' });
                        }
                    }}
                    title="Pull from remote repositories">
                    <PullIcon viewBox="0 0 24 24" width="100%" height="100%" />
                </ActionButton>
                <ActionButton
                    onClick={() => {
                        if (currentBranch.data) {
                            if (remotes.data?.length === 0) {
                                dialog.open({
                                    type: 'remote-configuration', remote: nothing,
                                    onConfirm: () => dialog.open({
                                        type: 'fetch-dialog',
                                        onConfirm: () => {
                                            dialog.open({
                                                type: 'request-upstream',
                                                forBranch: currentBranch.data!,
                                                currentUpstream: fromNullable(currentBranch.data!.upstream),
                                            })
                                        }
                                    })
                                })
                            } else {
                                dialog.open({
                                    type: 'request-upstream',
                                    forBranch: currentBranch.data,
                                    currentUpstream: fromNullable(currentBranch.data.upstream),
                                });
                            }
                        }
                    }}
                    title="Push changes to remote repositories">
                    <PushIcon viewBox="0 0 24 24" width="100%" height="100%" />
                </ActionButton>
                <ActionButton
                    onClick={() => dialog.open({ type: 'request-stash' })}
                    title="Stash working copy modifications">
                    <StashIcon viewBox="0 0 24 24" width="100%" height="100%" />
                </ActionButton>
                <div></div>
                <RouteAction route="/config" title="View/modify configuration">
                    <SettingsIcon viewBox="0 0 24 24" width="100%" height="100%" />
                </RouteAction>
            </ActionsContainer>
        );
    }
    return <></>;
};
