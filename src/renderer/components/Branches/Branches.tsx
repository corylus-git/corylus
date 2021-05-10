import * as React from 'react';
import styled from 'styled-components';

import { BranchInfo, RemoteMeta } from '../../../model/stateObjects';
import { TreeNode, Tree } from '../util/Tree/Tree';

import '../../../style/app.css';
import { insertPath } from '../util/Tree/utils';
import { remote } from 'electron';
import { Stashes } from './Stashes';
import { toast } from 'react-toastify';
import { TagsList } from './TagsList';
import { TypeHeader } from './TypeHeader';
import { Maybe, map, nothing, toOptional, fromNullable, just } from '../../../util/maybe';
import { changeBranch, fetchRemote, deleteRemote, pull } from '../../../model/actions/repo';
import { Logger } from '../../../util/logger';
import { DialogActions, useDialog } from '../../../model/state/dialogs';
import {
    useBranches,
    useCurrentBranch,
    repoStore,
    useRemotes,
    useAffected,
} from '../../../model/state/repo';
import { StyledButton } from '../util/StyledButton';

import RemoteIcon from '../icons/Remote.svg';
import MergeIconSmall from '../icons/MergeIconSmall.svg';
import { Affected } from './Affected';

const { Menu, MenuItem } = remote;

export interface BranchesProps {
    branches: readonly BranchInfo[];
}

const Branch = styled.span<{ current: boolean } & React.HTMLProps<HTMLSpanElement>>`
    font-weight: ${(props) => (props.current ? 'bold' : 'inherit')};
    font-style: ${(props) => (props.current ? 'italic' : 'inherit')};
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    display: inline-block;
    width: 100%;
    box-sizing: border-box;
    position: relative;
    padding-left: 0.35rem;
`;

function openContextMenu(
    dialog: DialogActions,
    branch: Maybe<BranchInfo>,
    currentBranch: Maybe<BranchInfo>
) {
    if (branch.found) {
        const menu = new Menu();
        menu.append(
            new MenuItem({
                label: `Create new branch from ${branch.value.ref}`,
                click: () => {
                    dialog.open({
                        type: 'request-new-branch',
                        subType: 'branch',
                        source: just(branch.value.ref),
                        branchPrefix: nothing,
                    });
                },
            })
        );
        if ((branch.value.upstream?.behind ?? 0) > 0) {
            menu.append(
                new MenuItem({
                    label: `Update ${branch.value.ref} to remote tracking branch`,
                    click: () => {
                        if (currentBranch.found && branch.value.current) {
                            pull(
                                branch.value.upstream!.remoteName,
                                branch.value.upstream!.ref,
                                false
                            );
                        } else {
                            fetchRemote(
                                just(branch.value.upstream!.remoteName),
                                just(`${branch.value.upstream?.ref}:${branch.value.ref}`),
                                false
                            );
                        }
                    },
                })
            );
        }
        if (currentBranch.found && !branch.value.current) {
            menu.append(
                new MenuItem({
                    label: `Delete branch ${branch.value.ref}`,
                    click: () => {
                        dialog.deleteBranchDialog(branch.value);
                    },
                })
            );
            menu.append(
                new MenuItem({
                    label: `Merge ${branch.value.ref} into ${currentBranch.value.ref}`,
                    click: () => {
                        dialog.open({ type: 'request-merge', source: just(branch.value.ref) });
                    },
                })
            );
        }
        menu.popup({ window: remote.getCurrentWindow() });
    }
}

const UpstreamMissing = styled.span`
    display: inline-block;
    position: absolute;
    left: 0;
    bottom: 0.15rem;
    background-color: ${(props) => props.theme.colors.conflict};
    color: ${(props) => props.theme.colors.conflictText};
    border-radius: 50%;
    text-align: center;
    width: 0.5rem;
    height: 0.5rem;
    font-size: 0.5rem;
    z-index: 3;
`;

function doChangeBranch(dialog: DialogActions, branch: BranchInfo | undefined) {
    Logger().debug('doChangeBranch', 'Requested new target branch', { branch });
    if (branch && !branch.remote) {
        changeBranch(branch.ref);
    }
    if (branch?.remote) {
        if (!branch?.trackedBy) {
            dialog.open({ type: 'request-remote-checkout', remote: branch });
        } else {
            toast(
                `${branch.remote}/${branch.ref} is already tracked by ${branch.trackedBy}. Please switch to this branch instead`,
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
        <Branch
            title={
                toOptional(props.branch)?.upstream?.upstreamMissing
                    ? ` Warning: the upstream branch for this branch (${
                          toOptional(props.branch)?.upstream?.remoteName
                      }/${toOptional(props.branch)?.upstream?.ref}) no longer exists.`
                    : ''
            }
            current={!!toOptional(props.branch)?.current}
            onContextMenu={() => openContextMenu(dialog, props.branch, props.currentBranch)}>
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
                    <MergeIconSmall viewBox="0 0 24 24" width="0.75em" height="0.75em" />
                </Affected>
            )}
            {toOptional(props.branch)?.upstream?.upstreamMissing && (
                <UpstreamMissing title="Configured upstream branch no longer available">
                    x
                </UpstreamMissing>
            )}
        </Branch>
    );
};

function remoteContextMenu(remoteRepo: RemoteMeta, dialog: DialogActions) {
    const menu = Menu.buildFromTemplate([
        {
            label: 'Configure remote',
            click: () =>
                dialog.open({
                    type: 'remote-configuration',
                    remote: just(remoteRepo),
                }),
        },
        {
            label: 'Delete remote',
            click: () => {
                if (
                    confirm(`Really delete remote ${remoteRepo.remote} and all related branches.`)
                ) {
                    deleteRemote(remoteRepo.remote);
                }
            },
        },
    ]);
    menu.popup({ window: remote.getCurrentWindow() });
}

const RemoteNameDisplay: React.FC<{ remote: RemoteMeta }> = (props) => {
    const dialog = useDialog();
    return (
        <span onContextMenu={() => remoteContextMenu(props.remote, dialog)}>
            <RemoteIcon height="1em" viewBox="0 0 24 20" />
            {props.remote.remote}
        </span>
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
                                (branch as BranchInfo)?.ref ? (branch as BranchInfo) : undefined
                            )}
                            affected={
                                props.affected.find(
                                    (a) =>
                                        !(branch as BranchInfo)?.remote &&
                                        a === (branch as BranchInfo)?.ref
                                ) !== undefined
                            }
                        />
                    );
                }
            }}
            onEntryClick={(meta) => {
                if ((meta as BranchInfo)?.head) {
                    repoStore.getState().selectCommit((meta as BranchInfo).head);
                }
            }}
            onEntryDoubleClick={(branch) => {
                (branch as BranchInfo)?.ref && doChangeBranch(dialog, branch as BranchInfo);
            }}
        />
    );
}

const SectionHeader = styled.div`
    position: relative;
    font-size: 1rem;
    border-top: 1px solid ${(props) => props.theme.colors.border};
    border-bottom: 1px solid ${(props) => props.theme.colors.border};
    background-color: ${(props) => props.theme.colors.highlight};
    margin-left: 5px;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    padding-left: 0.5rem;
    padding-top: 0.1rem;

    .add_remote {
        border-top-width: 0;
        border-bottom-width: 0;
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        background-color: unset;

        :hover {
            background-color: ${(props) => props.theme.colors.background};
        }
    }
`;

function calculateBranchTree(branches: readonly BranchInfo[], currentBranchRef: Maybe<string>) {
    const sortedBranches = [...branches].sort((b1, b2) => b1.ref.localeCompare(b2.ref));
    const tree = sortedBranches.reduce((nodes, branch) => {
        if (branch === undefined) {
            return nodes;
        }
        const segments = branch.ref.split('/');
        return insertPath(
            nodes,
            segments,
            branch,
            undefined,
            undefined,
            currentBranchRef.found && currentBranchRef.value.startsWith(branch.ref)
        );
    }, [] as readonly TreeNode<BranchInfo>[]);
    return tree;
}

function createBranchTreeData(
    local: readonly BranchInfo[],
    remote: readonly BranchInfo[],
    remotes: readonly RemoteMeta[],
    currentBranch: Maybe<BranchInfo>
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
                    map(currentBranch, (branch) => branch.ref)
                ),
                initialExpanded: true,
            },
            {
                label: 'Remote',
                children: Array.from(remoteMap.entries()).map(([label, entries]) => ({
                    label: label,
                    meta: remotes.find((r) => r.remote === label),
                    children: calculateBranchTree(entries, nothing),
                })),
            },
        ],
    };
}

export const Branches: React.FC = () => {
    const branches = useBranches();
    const currentBranch = useCurrentBranch();
    const remotes = useRemotes();
    const affected = useAffected();
    console.log('Affected', affected);
    const branchTree = React.useMemo(
        () =>
            currentBranch !== undefined &&
            createBranchTreeData(
                branches.filter((b) => !b.remote),
                branches.filter((b) => b.remote),
                remotes,
                currentBranch
            ),
        [branches, currentBranch]
    );

    return (
        <>
            {branchTree && (
                <BranchTree
                    root={branchTree}
                    currentBranch={currentBranch}
                    affected={affected.branches}
                />
            )}
            <TagsList />
            <Stashes />
        </>
    );
};
