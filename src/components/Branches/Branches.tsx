import * as React from 'react';
import styled from 'styled-components';
import { open } from '@tauri-apps/api/dialog';

import { BranchInfo, RemoteMeta } from '../../model/stateObjects';
import { TreeNode, Tree } from '../util/Tree/Tree';

import '../../style/app.css';
import { insertPath } from '../util/Tree/utils';
import { Stashes } from './Stashes';
import { toast } from 'react-toastify';
import { TagsList } from './TagsList';
import { TypeHeader } from './TypeHeader';
import { Maybe, nothing, toOptional, fromNullable, just } from '../../util/maybe';
import { changeBranch, fetchRemote, deleteRemote, pull, push, addWorktree, selectCommit } from '../../model/actions/repo';
import { Logger } from '../../util/logger';
import { DialogActions, useDialog } from '../../model/state/dialogs';
import {
    useCurrentBranch,
    useRemotes,
    useAffectedBranches,
    useBranches,
} from '../../model/state/repo';
import { StyledButton } from '../util/StyledButton';

import RemoteIcon from '../icons/Remote.svg';
import MergeIconSmall from '../icons/MergeIconSmall.svg';
import { Affected } from './Affected';
import { isInProgress } from '../../model/state/uiState';
import { Hoverable } from '../StyleBase';
import { WorkTree } from './WorkTree';
import { UpstreamMissing } from './UpstreamMissing';
import { SectionHeader } from './SectionHeader';
import { getTab, tabsStore } from '../../model/state/tabs';
import { ControlledMenu, ControlledMenuProps, MenuGroup, MenuItem, useMenuState } from '@szhsin/react-menu';
import { ConfirmationDialog } from '../Dialogs/ConfirmationDialog';
import { queryClient } from '../../util/queryClient';

export interface BranchesProps {
    branches: readonly BranchInfo[];
}

const Branch = styled.span<{ current: boolean, worktree: boolean } & React.HTMLProps<HTMLSpanElement>>`
    ${Hoverable}
    font-weight: ${(props) => (props.current ? 'bold' : 'inherit')};
    font-style: ${(props) => (props.current || props.worktree ? 'italic' : 'inherit')};
    background-color: ${(props) => (props.current ? 'var(--selected)' : 'inherit')};
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    display: inline-block;
    width: 100%;
    box-sizing: border-box;
    position: relative;
    padding-left: 0.35rem;
`;

const ContextMenu: React.FC<{
    dialogActions: DialogActions,
    branch: BranchInfo,
    currentBranch: Maybe<BranchInfo>,
} & ControlledMenuProps> = (props) => {

    if (props.branch) {
        return (<ControlledMenu {...props} portal>
            {
                props.branch &&
                <MenuItem onClick={() => {
                    props.branch && props.dialogActions.open({
                        type: 'request-new-branch',
                        subType: 'branch',
                        source: just(props.branch.refName),
                        branchPrefix: nothing,
                    });
                }}>Create new branch from {props.branch.refName}</MenuItem>
            }
            {
                (props.branch.upstream?.behind ?? 0) > 0 &&
                <MenuItem onClick={() => {
                    if (props.branch) {
                        if (props.currentBranch.found && props.branch.current) {
                            pull(
                                props.branch.upstream!.remoteName,
                                props.branch.upstream!.refName,
                                false
                            );
                        } else {
                            fetchRemote(
                                just(props.branch.upstream!.remoteName),
                                just(`${props.branch.upstream?.refName}:${props.branch.refName}`),
                                false,
                                false
                            );
                        }
                    }
                }}>Update {props.branch.refName} to remote tracking branch</MenuItem>
            }
            {
                (props.branch.upstream?.ahead ?? 0) > 0 &&
                <MenuItem onClick={() => {
                    props.branch && push(
                        props.branch.refName,
                        props.branch.upstream!.remoteName,
                        props.branch.upstream!.refName
                    );
                }}>Push {props.branch.refName} to remote tracking branch</MenuItem>
            }
            {
                props.currentBranch.found && !props.branch.current && <MenuGroup>
                    <MenuItem onClick={() => props.dialogActions.deleteBranchDialog(props.branch)}>Delete branch {props.branch.refName}</MenuItem>
                    <MenuItem onClick={() => props.dialogActions.open({ type: 'request-merge', source: just(props.branch.refName) })}>Merge {props.branch.refName} into {props.currentBranch.value.refName}</MenuItem>
                    <MenuItem>Rebase {props.currentBranch.value.refName} on {props.branch.refName}</MenuItem>
                    <MenuItem>Interactive rebase {props.currentBranch!.value.refName} on {props.branch.refName}</MenuItem>
                    {
                        props.branch.worktree && getTab(props.branch.worktree) && <MenuItem onClick={() => tabsStore.getState().switchTab(getTab(props.branch.worktree!)!)}>Switch to worktree tab at {props.branch.worktree}</MenuItem>
                    }
                    {
                        props.branch.worktree && !getTab(props.branch.worktree) && <MenuItem onClick={() => tabsStore.getState().openRepoInNew(props.branch.worktree!)}>Open worktree at {props.branch.worktree}</MenuItem>
                    }
                    {
                        !props.branch.worktree && <MenuItem onClick={async () => {
                            const dir = await open({
                                title: 'Choose parent directory to create the worktree in',
                                directory: true
                            });

                            if (dir && !Array.isArray(dir)) {
                                await addWorktree(`refs/heads/${props.branch.refName}`, dir);
                                tabsStore.getState().openRepoInNew(dir);
                            }
                        }}>Check {props.branch.refName} out as worktree</MenuItem>
                    }
                </MenuGroup>
            }
        </ControlledMenu>);
        //     if (currentBranch.found && !branch.value.current) {
        //         menu.append(
        //             new MenuItem({
        //                 label: `Delete branch ${branch.value.refName}`,
        //                 click: () => {
        //                     dialogActions.deleteBranchDialog(branch.value);
        //                 },
        //             })
        //         );
        //         menu.append(
        //             new MenuItem({
        //                 label: `Merge ${branch.value.refName} into ${currentBranch.value.refName}`,
        //                 click: () => {
        //                     dialogActions.open({ type: 'request-merge', source: just(branch.value.refName) });
        //                 },
        //             })
        //         );
        //         menu.append(
        //             new MenuItem({
        //                 label: `Rebase ${currentBranch.value.refName} on ${branch.value.refName}`,
        //                 click: () => {
        //                     dialogActions.open({ type: 'rebase', target: branch.value.refName });
        //                 },
        //             })
        //         );
        //         menu.append(
        //             new MenuItem({
        //                 label: `Interactive rebase ${currentBranch.value.refName} on ${branch.value.refName}`,
        //                 click: () => {
        //                     dialogActions.open({ type: 'interactive-rebase', target: branch.value.refName });
        //                 },
        //             })
        //         );
        //         if (branch.value.worktree) {
        //             const openTab = getTab(branch.value.worktree);
        //             if (openTab) {
        //                 menu.append(
        //                     new MenuItem({
        //                         label: `Switch to worktree tab at ${branch.value.worktree}`,
        //                         click: () => {
        //                             if (branch.value.worktree && openTab) {
        //                                 tabsStore.getState().switchTab(openTab);
        //                             }
        //                         },
        //                     })
        //                 );
        //             } else {
        //                 menu.append(
        //                     new MenuItem({
        //                         label: `Open worktree at ${branch.value.worktree}`,
        //                         click: () => {
        //                             if (branch.value.worktree) {
        //                                 tabsStore.getState().openRepoInNew(branch.value.worktree);
        //                             }
        //                         },
        //                     })
        //                 );
        //             }
        //         } else {
        //             menu.append(new MenuItem({
        //                 label: `Check ${branch.value.refName} out as worktree`,
        //                 click: async () => {
        //                         const dir = await dialog.showOpenDialog(getCurrentWindow(), {
        //                             properties: ['openDirectory'],
        //                             title: 'Choose directory to create the worktree in'
        //                         });
        //                         if (dir.filePaths && dir.filePaths.length === 1) {
        //                             await addWorktree(branch.value.refName, dir.filePaths[0]);
        //                             tabsStore.getState().openRepoInNew(dir.filePaths[0]);
        //                         }
        //                 },
        //             }))
        //         }
        //     }
        //     menu.popup({ window: getCurrentWindow() });
    }
    return <></>;
}

function doChangeBranch(dialog: DialogActions, branch: BranchInfo | undefined) {
    Logger().debug('doChangeBranch', 'Requested new target branch', { branch });
    if (branch && !branch.remote) {
        changeBranch(branch.refName);
    }
    if (branch?.remote) {
        if (!branch?.trackedBy) {
            dialog.open({ type: 'request-remote-checkout', remote: branch });
        } else {
            toast(
                `${branch.remote}/${branch.refName} is already tracked by ${branch.trackedBy}. Please switch to this branch instead`,
                { type: 'warning' }
            );
        }
    }
}

const BranchNodeDisplay: React.FC<{
    currentBranch: Maybe<BranchInfo>;
    label: string;
    path: readonly string[];
    branch: Maybe<BranchInfo>;
    affected: boolean;
}> = (props) => {
    const dialog = useDialog();
    const [menuProps, toggleMenu] = useMenuState();
    const [anchorPoint, setAnchorPoint] = React.useState({ x: 0, y: 0 });
    const inProgress = isInProgress(props.branch.found ? props.branch.value.refName : '');
    if (props.path.length === 0) {
        return <TypeHeader>Branches</TypeHeader>;
    }
    if (props.path.length === 1) {
        if (props.label === 'Remote') {
            // TODO: detecting the string of the label is less than optimal
            return (
                <SectionHeader>
                    {props.label}
                    <StyledButton
                        className="add_remote"
                        title="Add new remote repository"
                        onClick={() =>
                            dialog.open({
                                type: 'remote-configuration',
                                remote: nothing,
                            })
                        }>
                        +
                    </StyledButton>
                </SectionHeader>
            );
        }
        return <SectionHeader>{props.label}</SectionHeader>;
    }
    const statsParts = [
        toOptional(props.branch)?.upstream?.ahead &&
        `↑ ${toOptional(props.branch)?.upstream?.ahead}`,
        toOptional(props.branch)?.upstream?.behind &&
        `↓ ${toOptional(props.branch)?.upstream?.behind}`,
    ].filter((part) => part);
    return (
        <>
            {props.branch.found && <ContextMenu {...menuProps}
                onClose={() => toggleMenu(false)}
                branch={props.branch.value}
                dialogActions={dialog}
                currentBranch={props.currentBranch}
                anchorPoint={anchorPoint}
            />}

            <Branch
                className={inProgress ? 'in-progress' : undefined}
                title={
                    toOptional(props.branch)?.upstream?.upstreamMissing
                        ? ` Warning: the upstream branch for this branch (${toOptional(props.branch)?.upstream?.remoteName
                        }/${toOptional(props.branch)?.upstream?.refName}) no longer exists.`
                        : ''
                }
                current={!!toOptional(props.branch)?.current}
                worktree={!!toOptional(props.branch)?.worktree}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setAnchorPoint({ x: e.clientX, y: e.clientY });
                    toggleMenu(true);
                }}>
                <span
                    style={{
                        userSelect: 'text',
                        cursor: 'pointer',
                    }}>
                    {props.label}
                </span>
                {statsParts.length > 0 && (
                    <span style={{ fontSize: '80%', marginLeft: '1rem' }}>
                        ({statsParts.join(', ')})
                    </span>
                )}
                {props.branch.found && props.branch.value.isDetached && (
                    <span style={{ fontSize: '80%', marginLeft: '1rem' }}>[detached HEAD]</span>
                )}
                {props.affected && (
                    <Affected title="The branch contains the currently selected commit in its history">
                        <MergeIconSmall
                            viewBox="0 0 24 24"
                            width="0.75em"
                            height="0.75em"
                            fill="var(--background)"
                        />
                    </Affected>
                )}
                {toOptional(props.branch)?.upstream?.upstreamMissing && (
                    <UpstreamMissing title="Configured upstream branch no longer available">
                        x
                    </UpstreamMissing>
                )}
                {props.branch.found && !props.branch.value.current && props.branch.value.worktree &&
                    <WorkTree title={`This branch is checked out as a work tree at ${props.branch.value.worktree}`} isOnCommonPath={props.branch.value.isOnCommonPath} />
                }
            </Branch>
        </>
    );
};

function remoteContextMenu(remoteRepo: RemoteMeta, dialog: DialogActions) {
    // const menu = Menu.buildFromTemplate([
    //     {
    //         label: 'Configure remote',
    //         click: () =>
    //             dialog.open({
    //                 type: 'remote-configuration',
    //                 remote: just(remoteRepo),
    //             }),
    //     },
    //     {
    //         label: 'Delete remote',
    //         click: () => {
    //             if (
    //                 confirm(`Really delete remote ${remoteRepo.remote} and all related branches.`)
    //             ) {
    //                 deleteRemote(remoteRepo.remote);
    //             }
    //         },
    //     },
    // ]);
    // menu.popup({ window: getCurrentWindow() });
}

const RemoteNameDisplay: React.FC<{ remote: RemoteMeta }> = (props) => {
    const [menuProps, toggleMenu] = useMenuState();
    const [anchorPoint, setAnchorPoint] = React.useState({ x: 0, y: 0 });
    const dialog = useDialog();
    return (<span onContextMenu={(e) => {
        e.preventDefault();
        setAnchorPoint({ x: e.clientX, y: e.clientY });
        toggleMenu(true);
    }}>
        <ControlledMenu {...menuProps} anchorPoint={anchorPoint} onClose={() => toggleMenu(false)}>
            <MenuItem onClick={() => dialog.open({ type: 'remote-configuration', remote: just(props.remote) })}>Configure remote</MenuItem>
            <MenuItem onClick={() => dialog.open({
                type: 'confirmation-dialog',
                title: 'Delete remote',
                message: `Really delete ${props.remote.remote} and all related branches`,
                onConfirm: async () => {
                    await deleteRemote(props.remote.remote);
                    Logger().debug('RemoteNameDisplay', `Deleted remote ${props.remote.remote}`);
                    queryClient.invalidateQueries('remotes');
                }
            })}>Delete remote</MenuItem>
        </ControlledMenu>
        <RemoteIcon height="1em" viewBox="0 0 24 20" />
        {props.remote.remote}
    </span >
    );
};

function BranchTree(props: {
    root: TreeNode<BranchInfo | RemoteMeta>;
    currentBranch: Maybe<BranchInfo>;
    affected: string[];
}) {
    const dialog = useDialog();

    return (
        <Tree
            root={props.root}
            label={(label, path, _, branch) => {
                if ((branch as RemoteMeta)?.url !== undefined) {
                    return <RemoteNameDisplay remote={branch as RemoteMeta} />;
                } else {
                    return (
                        <BranchNodeDisplay
                            currentBranch={props.currentBranch}
                            label={label}
                            path={path}
                            branch={fromNullable(
                                (branch as BranchInfo)?.refName ? (branch as BranchInfo) : undefined
                            )}
                            affected={
                                props.affected.find(
                                    (a) =>
                                        !(branch as BranchInfo)?.remote &&
                                        a === (branch as BranchInfo)?.refName
                                ) !== undefined
                            }
                        />
                    );
                }
            }}
            onEntryClick={(meta) => {
                if ((meta as BranchInfo)?.head) {
                    selectCommit((meta as BranchInfo).head);
                    /*     repoStore.getState().setSelectedCommit((meta as BranchInfo).head); */
                }
            }}
            onEntryDoubleClick={(branch) => {
                (branch as BranchInfo)?.refName && doChangeBranch(dialog, branch as BranchInfo);
            }}
        />
    );
}

function calculateBranchTree(branches: readonly BranchInfo[], currentBranchRef: string | undefined) {
    const sortedBranches = [...branches].sort((b1, b2) => b1.refName.localeCompare(b2.refName));
    const tree = sortedBranches.reduce((nodes, branch) => {
        if (branch === undefined) {
            return nodes;
        }
        const segments = branch.refName.split('/');
        return insertPath(
            nodes,
            segments,
            branch,
            undefined,
            undefined,
            currentBranchRef?.startsWith(branch.refName)
        );
    }, [] as readonly TreeNode<BranchInfo>[]);
    return tree;
}

function createBranchTreeData(
    local: readonly BranchInfo[],
    remote: readonly BranchInfo[],
    remotes: readonly RemoteMeta[],
    currentBranch: BranchInfo | undefined
): TreeNode<BranchInfo | RemoteMeta> {
    const remoteMap = remote.reduce((existing, b) => {
        const remote = b.remote ?? '';
        existing.set(remote, [...(existing.get(remote) || []), b]);
        return existing;
    }, new Map<string, BranchInfo[]>(remotes.map((r) => [r.remote, []])));
    return {
        label: 'Branches',
        initialExpanded: true,
        children: [
            {
                label: 'Local',
                children: calculateBranchTree(
                    local,
                    currentBranch?.refName
                ),
                initialExpanded: true,
            },
            {
                label: 'Remote',
                children: Array.from(remoteMap.entries()).map(([label, entries]) => ({
                    label: label,
                    meta: remotes.find((r) => r.remote === label),
                    children: calculateBranchTree(entries, undefined),
                })),
            },
        ],
    };
}

const Branches: React.FC = () => {
    const { isLoading, error, data } = useBranches();
    const currentBranch = useCurrentBranch();
    const remotes = useRemotes();
    const affected = useAffectedBranches();
    const branchTree = React.useMemo(
        () =>
            data &&
            currentBranch.data !== undefined &&
            remotes.data &&
            createBranchTreeData(
                data.filter((b) => !b.remote),
                data.filter((b) => b.remote),
                remotes.data,
                currentBranch.data
            ),
        [data, currentBranch, remotes.data]
    );

    if (isLoading || remotes.isLoading) {
        return <div>Loading branches...</div>
    }
    if (error || remotes.error) {
        return <div>Could not load branch data.</div>
    }
    return <>
        {branchTree && (
            <BranchTree
                root={branchTree}
                currentBranch={fromNullable(currentBranch.data)}
                affected={affected}
            />
        )}
    </>
}

export const BranchesPanel: React.FC = () => {

    return (
        <>
            <Branches />
            <TagsList />
            <Stashes />
        </>
    );
};
