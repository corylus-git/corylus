import { RequestInitializeGitflow } from '../../util/workflows/gitflow';
import { Middleware } from './types';
import produce from 'immer';
import { Maybe, nothing } from '../../util/maybe';
import create from 'zustand/vanilla';
import createHook from 'zustand';
import { log } from './log';
import { BranchInfo, Stash, RemoteMeta } from '../stateObjects';
import { Logger } from '../../util/logger';
import { repoStore } from './repo';

export type RequestFetch = {
    type: 'request-fetch';
};

export type RequestPull = {
    type: 'request-pull';
};

export type RequestNewBranch = {
    type: 'request-new-branch';
    subType: 'branch' | 'commit' | 'none' | 'workflow';
    source: Maybe<string>;
    branchPrefix: Maybe<string>;
};

export type RequestRemoteCheckout = {
    type: 'request-remote-checkout';
    remote: BranchInfo;
};

export type RequestDeleteBranch = {
    type: 'request-delete-branch';
    branch: BranchInfo;
    isUnmerged: boolean;
};

export type RequestBranchReset = {
    type: 'request-branch-reset';
    branch: string;
    toRef: string;
};

export type RequestMerge = {
    type: 'request-merge';
    source: Maybe<string>;
};

export type RequestStash = {
    type: 'request-stash';
};

export type RequestStashApply = {
    type: 'request-stash-apply';
    stash: Stash;
};

export type RequestStashDrop = {
    type: 'request-stash-drop';
    stash: Stash;
};

export type RequestUpstream = {
    type: 'request-upstream';
    forBranch: BranchInfo;
};

export type RequestCreateTag = {
    type: 'request-create-tag';
    ref: string;
};

export type RemoteConfiguration = {
    type: 'remote-configuration';
    remote: Maybe<RemoteMeta>;
};

export type AddIgnoreListItem = {
    type: 'add-ignore-list-item';
    path: string;
};

export type Rebase = {
    type: 'rebase';
    target: string;
};
export type InteractiveRebase = {
    type: 'interactive-rebase';
    target: string;
};
export type AutoStash = {
    type: 'auto-stash';
    target: string;
};
/**
 * pseudo-state marking all dialogs closed
 */
export type NoDialog = {
    type: 'no-dialog';
};

/**
 * Dialogs without any additional data when opened
 */
export type SimpleDialogState = {
    type: 'simple-dialog';
    dialog: 'RequestFetch' | 'RequestUpstream' | 'AutoStash';
};

export type DialogState =
    | NoDialog
    | SimpleDialogState
    | RequestNewBranch
    | RequestUpstream
    | RequestDeleteBranch
    | RequestMerge
    | RequestBranchReset
    | RequestPull
    | RequestStash
    | RequestStashApply
    | RequestStashDrop
    | RequestCreateTag
    | RequestRemoteCheckout
    | RemoteConfiguration
    | AddIgnoreListItem
    | Rebase
    | InteractiveRebase
    | AutoStash
    // Gitflow initialization
    | RequestInitializeGitflow;

export type DialogActions = {
    open: (dialog: DialogState) => void;
    close: () => void;
    deleteBranchDialog: (branch: BranchInfo) => Promise<void>;
};

// Turn the set method into an immer proxy
const immer: Middleware<DialogState & DialogActions> = (config) => (set, get, api) =>
    config((fn: any) => set(produce(fn)), get, api);

export const dialogStore = create(
    log(
        immer((set, get) => ({
            type: 'no-dialog',
            open: (dialog: DialogState): void => {
                set((state) => ({ ...state, ...dialog }));
            },
            close: (): void => {
                set((_) => ({
                    type: 'no-dialog',
                }));
            },
            deleteBranchDialog: async (branch: BranchInfo): Promise<void> => {
                Logger().info('requestDeleteBranch', 'Requesting branch deletion', {
                    ref: branch.ref,
                });
                const r = repoStore.getState();
                Logger().debug(
                    'requestDeleteBranch',
                    'Checking whether branch has unmerged changes'
                );
                const unmergedBranches = await r.backend.getUnmergedBranches(nothing);
                const isUnmerged =
                    unmergedBranches.found &&
                    !!unmergedBranches.value.find((u) => u === branch.ref);
                get().open({
                    type: 'request-delete-branch',
                    branch: branch,
                    isUnmerged: isUnmerged,
                });
            },
        }))
    )
);

export const useDialog = createHook(dialogStore);
