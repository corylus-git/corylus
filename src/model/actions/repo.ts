import { SimpleGitBackend } from '../../util/GitBackend';
import { Logger } from '../../util/logger';
import { Tag, BranchInfo, Stash, IndexStatus, Commit } from '../stateObjects';
import { Maybe } from '../../util/maybe';
import { toast } from 'react-toastify';
import { structuredToast } from '../../util/structuredToast';
import { MergeResult } from 'simple-git/promise';
import { IndexTreeNode } from '../../renderer/components/Index/IndexTree';
import fs from 'fs';
import path from 'path';
import { repoStore } from '../state/repo';
import { progress } from '../state/progress';
import { stagingArea } from '../state/stagingArea';
import { trackError } from '../../util/error-display';
import { dialogStore } from '../state/dialogs';

export const commit = async (message: string, amend: boolean): Promise<void> => {
    Logger().debug('commit', 'Committing changes', { message: message, amend: amend });
    await repoStore.getState().backend.commit(message, amend);
    Logger().debug('commit', 'Success');
    repoStore.getState().loadHistory();
    repoStore.getState().loadBranches();
    repoStore.getState().getStatus();
};

export const changeBranch = trackError(
    'change branch',
    'changeBranch',
    async (ref: string, ignoreChanges = false, autoStashConfirmed = false): Promise<void> => {
        await repoStore.getState().getStatus();
        if (repoStore.getState().status.length !== 0 && !ignoreChanges) {
            if (!autoStashConfirmed) {
                dialogStore.getState().open({ type: 'auto-stash', target: ref });
            } else {
                Logger().debug('changeBranch', 'Requested auto-stashing changes during checkout');
                await repoStore.getState().backend.stash('Auto-stash during checkout', true);
                await repoStore.getState().backend.checkout(ref);
                const stashes = await repoStore.getState().backend.listStashes();
                await repoStore.getState().backend.applyStash(stashes[0], true);
                repoStore.getState().loadBranches();
            }
        } else {
            Logger().debug('changeBranch', 'Changing branch');
            await repoStore.getState().backend.checkout(ref);
            repoStore.getState().loadBranches();
        }
    }
);

export const fetchRemote = trackError(
    'fetch remote changes',
    'fetchRemote',
    async (remote: Maybe<string>, refSpec: Maybe<string>, prune: boolean): Promise<void> => {
        try {
            progress.getState().setProgress('Fetching remote changes', true);
            await repoStore.getState().backend.fetch({
                prune: prune,
                remote: remote,
                branch: refSpec,
            });
            progress.getState().setProgress('Finished fetching changes', false, 5000);
            repoStore.getState().loadHistory();
            repoStore.getState().loadBranches();
            repoStore.getState().loadRemotes();
        } catch (e) {
            progress.getState().setProgress('Failed fetching changes', false, 5000);
            throw e;
        }
    }
);

export const push = trackError(
    'push changes to upstream',
    'push',
    async (sourceBranch?: string, remote?: string, upstream?: string): Promise<void> => {
        try {
            progress.getState().setProgress('Pushing changes to upstream', true);
            await repoStore.getState().backend.push({
                branch: sourceBranch,
                remote: remote,
                upstream: upstream,
            });
            progress.getState().setProgress('Finished pushing changes', false, 5000);
            repoStore.getState().loadBranches();
            repoStore.getState().loadRemotes();
        } catch (e) {
            progress.getState().setProgress('Failed pushing changes', false, 5000);
            throw e;
        }
    }
);

export const createBranch = trackError(
    'create branch',
    'createBranch',
    async (name: string, source: string, checkout: boolean): Promise<void> => {
        Logger().info('createBranch', 'Creating new branch', {
            name: name,
            source: source,
            checkout: checkout,
        });
        await repoStore.getState().backend.branch(name, source, !checkout);
        Logger().info('createBranch', 'Success');
        repoStore.getState().loadBranches();
    }
);

export const deleteBranch = trackError(
    'delete branch',
    'deleteBranch',
    async (branch: BranchInfo, force: boolean, removeRemote: boolean): Promise<void> => {
        Logger().info('deleteBranch', 'Attempting to delete branch', {
            branch: branch,
            force: force,
            remoteRemote: removeRemote,
        });
        await repoStore.getState().backend.deleteBranch(branch, force, removeRemote);
        Logger().info('deleteBranch', 'Success');
        repoStore.getState().loadBranches();
    }
);

export const merge = async (from: string, noFF: boolean): Promise<void> => {
    try {
        await repoStore.getState().backend.merge(from, noFF);
        repoStore.getState().loadBranches();
        repoStore.getState().loadHistory();
        repoStore.getState().getStatus();
    } catch (e) {
        if (e.git && ((e.git as MergeResult)?.conflicts?.length ?? 0 !== 0)) {
            toast.error(
                'Merge failed due to conflicted files. Please review the conflicts and continue or abort the merge',
                { autoClose: false }
            );
        } else if (e.task) {
            toast.error(structuredToast('Merge aborted.', e.message.split(/\n/)), {
                autoClose: false,
            });
        } else {
            toast.error(`Merge failed with an unknown error: ${e.result}`, {
                autoClose: false,
            });
        }
        throw e;
    }
};

export const abortMerge = trackError(
    'abort merge',
    'abortMerge',
    async (): Promise<void> => {
        await repoStore.getState().backend.abortMerge();
        toast('Merge aborted', { type: 'success' });
        repoStore.getState().getStatus();
    }
);

export const resetBranch = trackError(
    'reset branch',
    'resetBranch',
    async (branch: string, toRef: string, mode: string): Promise<void> => {
        Logger().debug('resetBranch', 'Resetting branch', {
            branch: branch,
            toRef: toRef,
            mode: mode,
        });
        await repoStore.getState().backend.reset(branch, toRef, mode);
        repoStore.getState().loadBranches();
        repoStore.getState().getStatus();
        Logger().debug('resetBranch', 'Reset finished');
    }
);

export const pull = trackError(
    'pull changes from remote',
    'pull',
    async (remote: string, remoteBranch: string, noFF: boolean): Promise<void> => {
        try {
            Logger().debug('pull', 'Pulling remote changes', {
                remote: remote,
                remoteBranch: remoteBranch,
                noFF: noFF,
            });
            progress.getState().setProgress('Pulling changes from upstream', true);
            await repoStore.getState().backend.pull(remote, remoteBranch, noFF);
            progress.getState().setProgress('Finished pulling changes', false, 5000);
            repoStore.getState().loadBranches();
            repoStore.getState().loadHistory();
        } catch (e) {
            progress.getState().setProgress('Failed pulling changes', false, 5000);
            throw e;
        }
    }
);

export const clone = trackError(
    'clone remote repository',
    'clone',
    async (url: string, localDir: string): Promise<void> => {
        try {
            Logger().debug('clone', 'Cloning remote URL', { url: url, localDir: localDir });
            progress.getState().setProgress(`Cloning ${url} into ${localDir}.`, true, 5000);
            const backend = new SimpleGitBackend(localDir);
            await backend.clone(url, localDir);
            Logger().debug('clone', 'Success');
            progress.getState().setProgress(`Finished cloning ${url}.`, false, 5000);
            repoStore.getState().openRepo(localDir);
        } catch (e) {
            progress.getState().setProgress(`Failed cloning ${url}.`, false, 5000);
            throw e;
        }
    }
);

export const init = trackError(
    'initialize new repository',
    'init',
    async (dir: string): Promise<void> => {
        Logger().debug('init', 'Initializing new git repository', { dir: dir });
        const backend = new SimpleGitBackend(dir);
        await backend.init(dir);
        Logger().debug('init', 'Success');
        repoStore.getState().openRepo(dir);
    }
);

export const stage = trackError(
    'stage changes',
    'stage',
    async (path: IndexTreeNode): Promise<void> => {
        Logger().debug('stage', `Attempting to stage changes for ${path.path}.`, {
            path: path,
        });
        if (path.workdirStatus === 'deleted') {
            await repoStore.getState().backend.removePath(path.path, true);
            Logger().debug('stage', 'Successfully staged file deletion');
            repoStore.getState().getStatus();
        } else {
            await repoStore.getState().lock.acquire('git', async () => {
                await repoStore.getState().backend.addPath(path.path);
                Logger().debug('stage', 'Successfully staged change');
            });
            repoStore.getState().getStatus();
        }
    }
);

export const unstage = trackError(
    'unstage changes',
    'unstange',
    async (path: IndexTreeNode): Promise<void> => {
        Logger().debug('unstage', `Trying to unstage changes for ${path.path}`, {
            path: path,
        });
        await repoStore.getState().backend.resetPath(path.path);
        Logger().debug('unstage', 'Successfully unstaged change');
        repoStore.getState().getStatus();
    }
);

export const addDiff = trackError(
    'add partial diff to index',
    'addDiff',
    async (
        diff: string,
        path: string,
        source: 'workdir' | 'index',
        revert: boolean
    ): Promise<void> => {
        try {
            await repoStore.getState().backend.applyDiff(diff, revert, false);
            repoStore.getState().getStatus();
            const result = await repoStore
                .getState()
                .backend.getDiff({ source: source, path: path });
            if (!result) {
                stagingArea.getState().deselectDiff();
            } else {
                stagingArea.getState().loadDiff(source, path);
            }
        } catch (e) {
            Logger().debug('addDiff', 'Could not add diff to index', {
                diff: diff,
                path: path,
                source: source,
                revert: revert,
                error: e.toString(),
            });
        }
    }
);

export const stash = trackError(
    'stash changes',
    'stash',
    async (message: string, untracked: boolean): Promise<void> => {
        try {
            Logger().debug('stash', 'Stashing files', {
                message: message,
                untracked: untracked,
            });
            await repoStore.getState().backend.stash(message, untracked);
            Logger().debug('stash', 'Success');
            await repoStore.getState().loadStashes();
            repoStore.getState().getStatus();
        } catch (e) {
            Logger().error('stash', 'Could not stash changes', { error: e.toString() });
            throw e;
        }
    }
);

export const applyStash = trackError(
    'apply stash to working directory',
    'applyStash',
    async (stash: Stash, deleteAfterApply: boolean): Promise<void> => {
        Logger().debug('applyStash', 'Applying stash', {
            stash: stash,
            deleteAfterApply: deleteAfterApply,
        });
        await repoStore.getState().backend.applyStash(stash, deleteAfterApply);
        Logger().debug('applyStash', 'Success');
        await repoStore.getState().loadStashes();
        repoStore.getState().getStatus();
    }
);

export const dropStash = trackError(
    'drop stash',
    'dropStash',
    async (stash: Stash): Promise<void> => {
        Logger().debug('dropStash', 'Dropping stash', {
            stash: stash,
        });
        await repoStore.getState().backend.dropStash(stash);
        Logger().debug('dropStash', 'Success');
        await repoStore.getState().loadStashes();
        repoStore.getState().getStatus();
    }
);

export const createTag = trackError(
    'create new tag',
    'createTag',
    async (tag: string, ref: string, message: Maybe<string>): Promise<void> => {
        Logger().debug('createTag', 'Creating new tag', {
            ref: ref,
            tag: tag,
            message: message,
        });
        await repoStore.getState().backend.createTag(tag, ref, message);
        Logger().silly('createTag', 'Success.');
        await repoStore.getState().loadTags();
    }
);

export const deleteTag = trackError(
    'delete tag',
    'deleteTag',
    async (tag: Tag): Promise<void> => {
        Logger().debug('deleteTag', 'Deleting tag', { tag });
        await repoStore.getState().backend.deleteTag(tag);
        Logger().silly('deleteTag', 'Success');
        await repoStore.getState().loadTags();
    }
);

export const resolveConflict = trackError(
    'resolve conflict',
    'resolveConflict',
    async (conflictedPath: string, resolution: 'ours' | 'theirs'): Promise<void> => {
        Logger().debug('resolveConflict', 'Resolving file conflict', {
            conflictedPath,
            resolution,
        });
        await repoStore.getState().backend.resolveConflict(conflictedPath, resolution);
        Logger().silly('resolveConflict', 'Success');
        repoStore.getState().getStatus();
    }
);

export const saveManualMerge = trackError(
    'save manual conflict resolution',
    'saveManualMerge',
    async (filePath: string, code: string): Promise<void> => {
        Logger().debug('saveManualMerge', 'Attempting to save manual conflict resolution result', {
            path: filePath,
            code: code,
        });
        fs.writeFileSync(path.join(repoStore.getState().backend.dir, filePath), code);
        await repoStore.getState().backend.addPath(filePath);
        repoStore.getState().getStatus();
        Logger().debug('saveManualMerge', 'Success');
    }
);

export const discardChanges = trackError(
    'discard changes',
    'discardChanges',
    async (node: IndexStatus): Promise<void> => {
        switch (node.workdirStatus) {
            case 'modified':
            case 'deleted':
            case 'unknown': // directories
                await repoStore.getState().backend.restore(node.path);
                break;
            case 'untracked':
                fs.unlinkSync(path.join(repoStore.getState().backend.dir, node.path));
                break;
        }
        repoStore.getState().getStatus();
    }
);

export const remoteCheckout = trackError(
    'check out remote branch',
    'remoteCheckout',
    async (remote: BranchInfo, local: string): Promise<void> => {
        Logger().debug('remoteCheckout', 'Checking out remote branch', {
            remote,
            local,
        });
        await repoStore.getState().backend.checkout(`${remote.remote}/${remote.ref}`, local);
        repoStore.getState().loadBranches();
    }
);

export const discardDiff = trackError(
    'discard partial changes',
    'discardDiff',
    async (path: string, diff: string): Promise<void> => {
        Logger().debug('discardDiff', 'Discarding diff', { path: path });
        Logger().silly('discardDiff', 'Diff is', { diff: diff });
        await repoStore.getState().backend.applyDiff(diff, true, true); // revert this diff in the working copy
        Logger().silly('discardDiff', 'Success.');
        repoStore.getState().getStatus();
    }
);

export const addRemote = trackError(
    'add new remote',
    'addRemote',
    async (name: string, url: string): Promise<void> => {
        Logger().debug('addRemote', 'Adding new remote', { name, url });
        await repoStore.getState().backend.addRemote(name, url);
        await repoStore.getState().loadRemotes();
    }
);

export const updateRemote = trackError(
    'update remote configuration',
    'updateRemote',
    async (name: string, url: string): Promise<void> => {
        Logger().debug('updateRemote', 'Updating remote', { name, url });
        await repoStore.getState().backend.updateRemote(name, url);
        await repoStore.getState().loadRemotes();
    }
);

export const deleteRemote = trackError(
    'delete remote',
    'deleteRemote',
    async (name: string): Promise<void> => {
        Logger().debug('deleteRemote', 'Deleting remote', { name });
        await repoStore.getState().backend.deleteRemote(name);
        await repoStore.getState().loadRemotes();
    }
);

export const addToGitIgnore = trackError(
    'add entry to .gitignore',
    'addToGitIgnore',
    async (pattern: string): Promise<void> => {
        Logger().debug('addToGitIgnore', 'Adding pattern to .gitignore', { pattern });
        const p = path.join(repoStore.getState().backend.dir, '.gitignore');
        await fs.promises.appendFile(p, `${pattern}\n`);
        repoStore.getState().getStatus();
    }
);

export const rebase = trackError(
    'rebasing commits',
    'rebase',
    async (
        target: string,
        commands?: readonly { action: string; commit: Commit }[]
    ): Promise<void> => {
        Logger().debug('rebase', 'Rebasing current branch', { target, commands });
        await repoStore.getState().backend.rebase(target, commands);
        const promises = [
            repoStore.getState().loadHistory(),
            repoStore.getState().loadBranches(),
            repoStore.getState().loadTags(),
            repoStore.getState().getRebaseStatus(),
        ];
        await Promise.all(promises);
    }
);

export const abortRebase = trackError(
    'aborting rebase',
    'abortRebase',
    async (): Promise<void> => {
        Logger().debug('abortRebase', 'Aborting current rebase');
        await repoStore.getState().backend.abortRebase();
        const promises = [
            repoStore.getState().loadHistory(),
            repoStore.getState().loadBranches(),
            repoStore.getState().loadTags(),
            repoStore.getState().getRebaseStatus(),
        ];
        await Promise.all(promises);
    }
);
