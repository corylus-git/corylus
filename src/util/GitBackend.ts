import util from 'util';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import simpleGit, { SimpleGit, LogOptions } from 'simple-git';
import temp from 'temp';

const writeAsync = util.promisify(fs.write);
const tempOpenAsync = util.promisify(temp.open);
const execAsync = util.promisify(exec);
const readFileAsync = util.promisify(fs.readFile);

import {
    BranchInfo,
    RemoteMeta,
    Commit,
    CommitStats,
    DiffStat,
    DiffStatus,
    IndexStatus,
    UpstreamInfo,
    Stash,
    FullCommit,
    Tag,
    BlameInfo,
    RebaseStatusInfo,
    RebaseAction,
} from '../model/stateObjects';
import { ConfigValues } from 'simple-git/typings/response';
import { Logger } from './logger';
import { chunks } from './ImmutableArrayUtils';
import { toast } from 'react-toastify';
import { structuredToast } from './structuredToast';
import { nanoid } from 'nanoid';
import {
    IEffectiveConfig,
    IGitConfig,
    IGitConfigValues,
    IGitFlowConfig,
} from '../model/IGitConfig';
import { Maybe, fromNullable, nothing, just } from './maybe';

export type ProgressEventType = string;
export type ProgressCallback = (type: ProgressEventType, output?: string) => void;

export interface GitBackend {
    /**
     * Get the path to the working directory opened by this backend
     */
    readonly dir: string;

    /**
     * Open a working copy and initialize the internal state of the backend to work
     * with the working copy.
     *
     * @param directory The working copy to open with the backend
     */
    open(directory: string): Promise<void>;

    /**
     * Return all known branches, local and remote
     */
    getBranches(): Promise<BranchInfo[]>;

    /**
     * Return all defined remotes
     */
    getRemotes(): Promise<RemoteMeta[]>;

    /**
     * Return all tags in the repository
     */
    getTags(): Promise<readonly Tag[]>;

    /**
     * Get the total number of commits in the repository
     */
    getHistorySize(): Promise<number>;

    /**
     * Get the commit history from this backend
     */
    getHistory(
        path?: string,
        skip?: number,
        limit?: number,
        range?: string
    ): Promise<readonly Commit[]>;

    /**
     * Get the detailed commit information for a given ref
     *
     * @param ref The ref for which to get the commit. Could be a branch name, tag, commit ID, one of HEAD, MERGE_HEAD etc.
     */
    getCommit(ref: string): Promise<Commit>;

    /**
     * Check out a specific git ref (branch, tag etc.)
     * @param refOrPath The git ref or path to check out
     * @param localTarget The local target branch in case of checking out a remote branch
     */
    checkout(refOrPath: string, localTarget?: string): Promise<void>;

    /**
     * Resolve a merge conflict for a specific patch by selecting a specific version
     *
     * @param path The path for which to resolve the conflict
     * @param source Resolve the conflict by selecting our version or the incoming (theirs)
     */
    resolveConflict(path: string, source: 'ours' | 'theirs' | 'merge'): Promise<void>;

    /**
     * Get the statistics (insertions, deletions) of a specific commit
     *
     * @param oid The object id of the commit in question
     */
    getCommitStats(commit: Commit): Promise<CommitStats>;

    /**
     * Load a diff from a specific commit
     *
     * @param options the options to use for retrieving the diff
     */
    getDiff(options: {
        /**
         * From where to load the diff: from the workdir to the index, the index to the last commit or the change in the given commit
         */
        source: 'workdir' | 'index' | 'commit' | 'stash';
        /**
         * The ID of the commit for which to load the diff. Only valid for source=commit
         */
        commitId?: string;
        /**
         * ID of the commit to diff to. This will retrieve the diff in toParent..commitId
         */
        toParent?: string;
        /**
         * The path of the file from the commit for which to load the diff. If this is undefined, the whole
         *  source diff
         */
        path?: string;
        /**
         * Indicate whether the file to be loaded is untracked. Only relevant for stashed untracked files
         */
        untracked?: boolean;
    }): Promise<string>;

    /**
     * Get the current status
     */
    getStatus(): Promise<readonly IndexStatus[]>;

    /**
     * Add a path (file or whole directory to the index)
     *
     * @param path The path to add
     * @param intentToAdd Don't add the file contents, but rather just record the
     *                    intention to add parts of it later
     */
    addPath(path: string, intentToAdd?: boolean): Promise<void>;

    /**
     * Remove a path from the git repository
     *
     * @param path The path to remove from the git repository
     * @param alreadyGone The file was already deleted in the file system. Record the deletion in the index.
     */
    removePath(path: string, alreadyGone: boolean): Promise<void>;

    /**
     * Apply a given diff to the working copy or the index
     *
     * @param diff The diff to add to the index
     * @param revert Apply the diff in reverse
     * @param onWorkinCopy Apply the diff to the working copy instead of adding it to the index
     */
    applyDiff(diff: string, revert: boolean, onWorkinCopy: boolean): Promise<void>;

    /**
     *
     * @param path Execute git reset on the path in question
     */
    resetPath(path: string): Promise<void>;

    /**
     * Commit the current index.
     *
     * The repository should be reloaded after this call.
     *
     * @param message The commit message to use
     * @param amend Amend the last commit?
     */
    commit(message: string, amend?: boolean): Promise<void>;

    /**
     * Push the current branch to a remote.
     *
     * The repository should be reloaded after this call
     *
     * @param options The options for the push operation
     * @param options.remote The remote to push to. This is mostly when targeting different remotes.
     * @param options.branch The branch to push to at the remote.
     * @param options.upstream The name of the branch in the upstream repo
     * @param options.setUpstream Set the given remote branch as the tracking branch
     * @param options.force Perform a force push
     */
    push(options?: {
        remote?: string;
        branch?: string;
        upstream?: string;
        setUpstream?: boolean;
        force?: boolean;
    }): Promise<void>;

    /**
     * Fetch changes from one or more remotes. Implementations must emit any progress information via the 'progress' event,
     * if given an options.requestId
     *
     * @param options The configuration for the fetch operation
     * @param options.remote The remote to fetch. If no remote is given, all are fetched by default
     * @param options.prune Remove remote tracking branches no longer present in the remote repository
     */
    fetch(options: { remote: Maybe<string>; branch: Maybe<string>; prune: boolean }): Promise<void>;

    /**
     * Pull changes from upstream into the current tracking branch
     *
     * @param noFF Always create a merge commit, even if a fast-forward would have been possible
     * @param remote The remote to pull from
     * @param remoteBranch The remote branch to pull
     */
    pull(remote: string, remoteBranch: string, noFF: boolean): Promise<void>;

    /**
     * Initialize a new empty git repository at the given path
     */
    init(path: string): Promise<void>;

    /**
     * Clone a remote repository to a local directory
     *
     * @param url The URL to clone the repository from
     * @param dir The local directory to clone the repository into
     */
    clone(url: string, dir: string): Promise<void>;

    /**
     * Create a new branch
     *
     * @param name The name of the new branch
     * @param source The source branch/commit/tag from which to create the branch
     * @param noCheckout Check out the branch after creation
     */
    branch(name: string, source: string, noCheckout: boolean): Promise<void>;

    /**
     * Delete a specific branch
     *
     * @param branch The branch to delete
     * @param force Indicates whether to delete the branch even if it is not fully merged into the current HEAD
     * @param removeRemote For tracking-branches: remote the upstream branch as well
     */
    deleteBranch(branch: BranchInfo, force: boolean, removeRemote: boolean): Promise<void>;

    /**
     * Rename a branch
     *
     * @param oldName The old name of the branch
     * @param newName The new name of the branch
     */
    renameBranch(oldName: string, newName: string): Promise<void>;

    /**
     * Check which branches are not yet merged into the given ref.
     *
     * @param name The target commit/ref to check
     */
    getUnmergedBranches(name: Maybe<string>): Promise<Maybe<string[]>>;

    /**
     * Merge a given source into the current branch
     *
     * @param from The source ref to merge from. Could be either a branch, a tag or a commit
     * @param noFF Always create a new merge commit (--no-fastforward)
     * @returns A promise resolving to undefined if the merge was successful, an error message otherwise
     */
    merge(from: string, noFF: boolean): Promise<string | undefined>;

    /**
     * Abort a pending merge (i.e. when failing to resolve a conflict)
     */
    abortMerge(): Promise<string | undefined>;

    /**
     * Get the current pending commit message. This is used in case of a merge conflict to retrieve the
     * commit message generated by git.
     */
    getPendingCommitMessage(): string;

    /**
     * Stash current modification in the working copy
     *
     * @param message The message to attach to the stash
     * @param untracked Include untracked files in the stash
     */
    stash(message: string, untracked: boolean): Promise<void>;

    /**
     * List the stashes available in the repository
     */
    listStashes(): Promise<readonly Stash[]>;

    /**
     * Get the details (i.e. changes etc. for a stash)
     *
     * @param stash The stash to get the details for
     */
    getStashDetails(stash: Stash): Promise<CommitStats>;

    /**
     * Apply a stash to the working copy
     *
     * @param stash The stash to apply to the working copy
     * @param deleteAfterApply Delete the stash after successful application
     */
    applyStash(stash: Stash, deleteAfterApply: boolean): Promise<void>;

    /**
     * Drop a stash from the repository
     *
     * @param stash The stash to drop from the repository
     */
    dropStash(stash: Stash): Promise<void>;

    /**
     * Retrieve the git configuration
     */
    getConfig(): Promise<IGitConfig>;

    /**
     * Reset a branch to a given commit
     *
     * @param branch The branch to reset
     * @param toRef The ref to reset the branch to
     * @param mode The reset mode to use
     */
    reset(branch: string, toRef: string, mode: string): Promise<void>;

    /**
     * Create a new tag at the given commit
     *
     * @param tag The name of the tag to create
     * @param ref The ref/commit id to create the tag at
     * @param message The optional message, turning the tag into an annotated tag
     */
    createTag(tag: string, ref: string, message: Maybe<string>): Promise<void>;

    /**
     * Delete the given tag
     *
     * @param tag The tag to remove
     */
    deleteTag(tag: Tag): Promise<string>;

    /**
     * Get all files in the working directory
     */
    getFiles(): Promise<string[]>;

    /**
     * Load blame info for the given file
     *
     * @param path The path of the file to load the blame info for
     */
    blame(path: string): Promise<readonly BlameInfo[]>;

    /**
     * Set a specific git configuration variable in the repository-specific config
     *
     * @param variable The name of the variable to set
     * @param value The value of the variable to set
     */
    setConfigVariable(variable: string, value: string): Promise<void>;

    /**
     * Restore a given path to the state as in the index/repository
     * @param path The path to restore to the committed state
     */
    restore(path: string): Promise<void>;

    /**
     * Add a new remote to the repository
     *
     * @param name The name of the new remote
     * @param url The url to pull/push to/from.
     */
    addRemote(name: string, url: string): Promise<void>;

    /**
     * Update remote repository configuration
     *
     * @param name The name of the remote to update
     * @param url The url to pull/push to/from.
     */
    updateRemote(name: string, url: string): Promise<void>;

    /**
     * Delete the given remote repo
     *
     * @param name The name of the remote to delete
     */
    deleteRemote(name: string): Promise<void>;

    /**
     * Rebase the current branch to the given target ref
     *
     * @param target The target ref to which to rebase the current branch
     * @param commands A list of commands on how to handle individual commits (interactive rebase case)
     */
    rebase(target: string, commands?: readonly { action: string; commit: Commit }[]): Promise<void>;

    /**
     * Get the status of the rebase currently in progress, if any.
     */
    getRebaseStatus(): Promise<Maybe<RebaseStatusInfo>>;

    /**
     * abort the currently running rebase
     */
    abortRebase(): Promise<void>;

    /**
     * Get the refs a commit is contained in, i.e. who contain the given ref
     * in their histories.
     *
     * @param ref The ref to look up in the histories of other items
     * @param branches Get the name of all affected branches
     * @param tags Get the names of all affected tags
     * @param commits Get the OIDs of all affected commits
     */
    getAffectedRefs(
        ref: string,
        branches: boolean,
        tags: boolean,
        commits: boolean
    ): Promise<{ branches: string[]; tags: string[]; refs: string[] }>;
}

export class SimpleGitBackend implements GitBackend {
    private _git: SimpleGit;

    constructor(private directory: string) {
        this._git = simpleGit(directory);
    }

    get dir(): string {
        return this.directory;
    }

    open = (directory: string): Promise<void> => {
        this._git = simpleGit(directory);
        this.directory = directory;
        return Promise.resolve();
    };

    private getRefsAndUpstreams = async () => {
        return (
            await this._git.raw([
                'for-each-ref',
                'refs/heads',
                '--format=%(refname)|--/%(objectname)|--/%(upstream)',
            ])
        )
            ?.split('\n')
            .filter((line) => line.length > 0)
            .map((line) => {
                const parts = line.split('|--/');
                return {
                    ref: parts[0].replace('refs/heads/', ''),
                    oid: parts[1],
                    upstream: parts[2].replace(/^refs\/remotes\/[^/]+\//, ''),
                    remote: parts[2].replace(/^refs\/remotes\/([^/]+)\/.*/, '$1'),
                };
            });
    };

    private getTrackingDifference = async (
        local: string,
        upstream: string
    ): Promise<{ ahead: number; behind: number }> => {
        Logger().debug('SimpleGitBacken', 'Trying to get tracking difference', {
            local: local,
            upstream: upstream,
        });
        const result = (await this._git.raw(['rev-list', '--left-right', `${local}...${upstream}`]))
            ?.split('\n')
            .filter((line) => line.length > 0)
            .reduce(
                (stats, entry) => {
                    if (entry.startsWith('<')) {
                        return { ahead: stats.ahead + 1, behind: stats.behind };
                    }
                    return { ahead: stats.ahead, behind: stats.behind + 1 };
                },
                { ahead: 0, behind: 0 }
            );
        return result ?? { ahead: 0, behind: 0 };
    };

    getBranches = async (): Promise<BranchInfo[]> => {
        performance.mark('startBranches');
        const branches = await this._git.branch(['--no-abbrev', '--all']);
        performance.mark('endBranches');
        performance.measure('branches', 'startBranches', 'endBranches');
        const trackedBranches = (await this.getRefsAndUpstreams())?.filter((r) => r.upstream);
        const isDetached = (await this._git.revparse(['--symbolic-full-name', 'HEAD'])) === 'HEAD';
        const stats: { ref: string; stats: UpstreamInfo }[] = await Promise.all(
            trackedBranches?.map(async (branchInfo) => {
                const upstream = branches.all.find(
                    (b) => b === `remotes/${branchInfo.remote}/${branchInfo.upstream}`
                );
                let stats = { ahead: 0, behind: 0 };
                if (upstream) {
                    stats = await this.getTrackingDifference(
                        branchInfo.ref,
                        `${branchInfo.remote}/${branchInfo.upstream}`
                    );
                }
                return {
                    ref: branchInfo.ref,
                    stats: {
                        ...stats,
                        upstreamMissing: !upstream,
                        ref: branchInfo.upstream,
                        remoteName: branchInfo.remote,
                    },
                };
            }) || []
        );

        const ret =
            branches?.all.map((branch) => {
                return {
                    ref: branch.replace(/^(remotes\/([^/]+)\/)*/, ''),
                    head: branches.branches[branch].commit,
                    remote: branch.startsWith('remotes')
                        ? branch.replace(/^remotes\/([^/]+)\/.*/, '$1')
                        : undefined,
                    current: branches?.current === branch,
                    upstream: stats.find((stat) => stat.ref === branch)?.stats,
                    trackedBy: trackedBranches?.find(
                        (bi) => `remotes/${bi.remote}/${bi.upstream}` === branch
                    )?.ref,
                    isDetached: branches?.current === branch && isDetached,
                } as BranchInfo;
            }) || [];
        return ret;
    };

    getTags = async (): Promise<readonly Tag[]> => {
        const result = await this._git.raw(['show-ref', '--tags', '-d']);
        const lines = result?.split('\n');
        const regex = /^(?<oid>[a-f0-9]+)\s+refs\/tags\/(?<tagName>[^\s^]+)(?<commitMarker>\^\{\}){0,1}$/;
        return (
            lines
                ?.filter((l) => l && l.length > 0)
                .reduce((existing, l) => {
                    const parts = l.match(regex);
                    if (parts?.groups?.commitMarker) {
                        const i = existing.findIndex((e) => e.name === parts?.groups?.tagName);
                        if (i !== -1) {
                            existing[i].oid = existing[i].taggedOid;
                            existing[i].taggedOid = parts.groups.oid;
                        }
                        return existing;
                    }
                    return existing.concat({
                        name: parts!.groups!.tagName,
                        taggedOid: parts!.groups!.oid,
                    });
                }, [] as readonly Tag[]) ?? []
        );
    };

    getRemotes = async () => {
        try {
            const remotes = await this._git.getRemotes(true);
            Logger().silly('SimpleGitBackend', 'Got reply for getRemotes from git backend', {
                result: remotes,
                git: this._git,
                fn: this._git.getRemotes,
            });
            return (
                remotes?.map(
                    (remote) =>
                        ({
                            remote: remote.name,
                            url: remote.refs.fetch, // our model currently supports only one URL
                        } as RemoteMeta)
                ) || []
            );
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Could not get remotes', { error: e });
            throw e;
        }
    };

    private commitFormat = {
        hash: '%H',
        shortHash: '%h',
        message: '%B',
        author_name: '%aN',
        author_email: '%aE',
        author_date: '%ai',
        committer_name: '%cN',
        committer_email: '%cE',
        committer_date: '%ci',
        parents: '%P',
        short_parents: '%p',
    };

    private mapSummary = (summary: SimpleGitBackend['commitFormat']): FullCommit => {
        const p = summary.parents.split(' ').filter((p) => p != '');
        const sp = summary.short_parents.split(' ').filter((p) => p != '');
        return {
            type: 'commit',
            oid: summary.hash,
            short_oid: summary.shortHash,
            message: summary.message,
            author: {
                name: summary.author_name,
                email: summary.author_email,
                timestamp: new Date(summary.author_date),
            },
            committer: {
                name: summary.committer_name,
                email: summary.committer_email,
                timestamp: new Date(summary.committer_date),
            },
            parents: p.map((p, index) => ({ oid: p, short_oid: sp[index] })),
        };
    };

    getHistorySize = async (): Promise<number> => {
        const number = await this._git.raw(['rev-list', '--all', '--count']);
        return parseInt(number);
    };

    getHistory = async (
        path?: string,
        skip?: number,
        limit?: number,
        range?: string
    ): Promise<readonly Commit[]> => {
        const opts: Record<string, any> = {
            format: this.commitFormat,
            splitter: true,
            '--parents': true,
            '--remotes': true,
            '--topo-order': true,
        };
        if (skip) {
            opts['--skip'] = skip;
        }
        if (limit) {
            Logger().debug('getHistory', `Requesting ${limit} items from the history`);
            opts.maxCount = limit;
        }
        if (path) {
            opts['--'] = true;
            opts[path] = true;
        }
        if (range) {
            opts[range] = true;
        } else {
            opts['--branches'] = true;
        }
        const entries = await this._git.log<SimpleGitBackend['commitFormat']>(opts);
        Logger().debug('getHistory', `Received ${entries.all.length} from git`);
        return entries?.all.map((entry) => this.mapSummary(entry)) || [];
    };

    getCommit = async (ref: string): Promise<Commit> => {
        Logger().debug('SimpleGitBackend', 'Trying to get commit', { ref });
        const options: Record<string, any> = {
            format: { ...this.commitFormat, message: '%B' },
            splitter: '|--/',
            maxCount: 1,
        };
        options[ref] = true;
        const entries = await this._git.log<SimpleGitBackend['commitFormat']>(options);
        Logger().debug('SimpleGitBackend', 'Result', { entries: entries });
        return this.mapSummary(entries!.all[0]);
    };

    checkout = async (refOrPath: string, local?: string): Promise<void> => {
        let params = [refOrPath];
        if (local) {
            params = params.concat(['-t', '-b', local]);
        }
        await this._git.checkout(params);
    };

    resolveConflict = async (path: string, source: 'ours' | 'theirs' | 'merge'): Promise<void> => {
        try {
            Logger().debug('SimpleGitBackend', 'Attempting to resolve merge conflict', {
                path: path,
                source: source,
            });
            if (source !== 'merge') {
                await this._git.checkout([`--${source}`, path]);
            }
            await this._git.add(path);
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Failed to resolve merge conflict', {
                path: path,
                source: source,
                error: e,
            });
        }
    };

    abortMerge = async () => {
        try {
            await this._git.merge(['--abort']);
            return undefined;
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Could not abort merge', { error: e });
            return e.git.result;
        }
    };

    getCommitStats = async (commit: Commit): Promise<CommitStats> => {
        Logger().debug('SimpleGitBackend', 'Retrieving stats for commit', { oid: commit.oid });
        const directResult = await this._git.raw([
            'show',
            '--format=',
            '-z',
            '--name-status',
            commit.oid,
        ]);
        const fileStatus = parseFileStatus(directResult);
        const directNumStat = await this._git.raw([
            'show',
            '--numstat',
            '--format=',
            '-z',
            commit.oid,
        ]);
        Logger().debug('SimpleGitBackend', 'Received raw log', { log: directNumStat });
        mergeNumStats(directNumStat, fileStatus);
        let incoming: Maybe<readonly DiffStat[]> = nothing;
        if (commit.parents.length > 1 && commit.type === 'commit') {
            // this is a merge commit -> get the incoming changes
            Logger().debug('SimpleGitBackend', 'Retrieving incoming changes stats for commit', {
                oid: commit.oid,
            });
            const incomingResult = await this._git.raw([
                'diff',
                '--format=',
                '-z',
                '--name-status',
                `${commit.oid}^..${commit.oid}`,
            ]);
            incoming = just(parseFileStatus(incomingResult, `${commit.oid}^`));
            const incomingNumStat = await this._git.raw([
                'diff',
                '--numstat',
                '--format=',
                '-z',
                `${commit.oid}^..${commit.oid}`,
            ]);
            Logger().debug('SimpleGitBackend', 'Received raw log', { log: incomingNumStat });
            mergeNumStats(incomingNumStat, incoming.value);
        }
        return {
            commit: commit,
            direct: fileStatus,
            incoming: incoming,
        } as CommitStats;
    };

    getDiff = (options: {
        source: 'workdir' | 'index' | 'commit' | 'stash';
        commitId?: string;
        path?: string;
        toParent?: string;
        untracked?: boolean;
    }): Promise<string> => {
        if (options.source === 'commit' || options.source === 'stash') {
            let sourceCommit = options.commitId || '';
            if (options.untracked) {
                sourceCommit = `${sourceCommit}^3`;
            }
            let command = options.toParent
                ? ['diff', '--format=', `${options.toParent}..${sourceCommit}`]
                : ['show', '--format=', sourceCommit];
            if (options.path) {
                command = command.concat(['--', options.path]);
            }
            return this._git.raw(command) ?? Promise.resolve('');
        }
        let diffoptions = [] as string[];
        if (options.source === 'index') {
            diffoptions = diffoptions.concat('--staged');
        }
        if (options.path) {
            diffoptions = diffoptions.concat(['--', options.path]);
        }
        return this._git.diff(diffoptions) ?? Promise.resolve('');
    };

    getStatus = async (): Promise<readonly IndexStatus[]> => {
        const parsed = await this._git.raw(['status', '--porcelain', '-u', '-z']);
        const entries = parsed
            ?.split(/\0/)
            .filter((l) => !!l)
            .reduce((existing, line) => {
                if (
                    existing.length > 0 &&
                    (existing[existing.length - 1].index === 'R' ||
                        existing[existing.length - 1].workdir === 'R') &&
                    !existing[existing.length - 1].newPath
                ) {
                    const p = existing[existing.length - 1].path;
                    existing[existing.length - 1].path = line;
                    existing[existing.length - 1].newPath = p;
                    return existing;
                }
                return existing.concat([
                    {
                        index: line[0],
                        workdir: line[1],
                        path: line.substr(3),
                    },
                ]);
            }, [] as { index: string; workdir: string; path: string; newPath?: string }[]);

        const result =
            entries?.map((file) => {
                const indexStatus = mapCommitStatus(file.index);
                return {
                    path: file.path,
                    indexStatus: indexStatus,
                    workdirStatus: mapCommitStatus(file.workdir),
                    isStaged: file.index !== ' ',
                    isConflicted:
                        file.index === 'U' ||
                        file.workdir === 'U' ||
                        (file.index === 'A' && file.workdir === 'A') ||
                        (file.index === 'D' && file.workdir === 'D'),
                };
            }) || [];
        Logger().silly('SimpleGitBackend', 'Received git status', { status: result });
        return result;
    };

    addPath = async (path: string, intentToAdd?: boolean): Promise<void> => {
        if (intentToAdd) {
            await this._git.raw(['add', '-N', path]);
        } else {
            await this._git.add(path);
        }
    };

    applyDiff = (diff: string, revert: boolean, onWorkinCopy: boolean): Promise<void> => {
        try {
            const result = execSync(
                `git apply${onWorkinCopy ? '' : ' --cached'}${revert ? ' --reverse' : ''}`,
                {
                    input: diff,
                    cwd: this.directory,
                }
            );
            Logger().debug('SimpleGitBackend', 'Executed git apply', { result: result });
            return Promise.resolve();
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Failed git apply', { error: e });
            throw e;
        }
    };

    removePath = async (path: string, alreadyGone: boolean): Promise<void> => {
        const opts = alreadyGone ? ['--cached', '--'] : [];
        try {
            await this._git.raw(['rm'].concat(opts).concat(path));
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Attempting to stage file deletion failed', {
                error: e,
            });
            throw e;
        }
    };

    resetPath = async (path: string): Promise<void> => {
        Logger().silly('SimpleGitBackend', 'Resetting path', { path: path });
        await this._git.reset(['--', path]);
        Logger().silly('SimpleGitBackend', 'Reset path done', { path: path });
    };

    commit = async (message: string, amend?: boolean) => {
        Logger().silly('SimpleGitBackend', 'Attemping commit', {
            commitMessage: message,
            amend: amend,
        });
        let options = [] as string[];
        if (amend) {
            options = options.concat('--amend');
        }
        const result = await this._git.raw(['commit', '-m', message].concat(options));
        Logger().debug('SimpleGitBackend', 'Commit done.', { result: result });
    };

    push = async (options?: {
        remote?: string;
        branch?: string;
        upstream?: string;
        setUpstream?: boolean;
        force?: boolean;
    }): Promise<void> => {
        let branch = options?.branch;
        const opts = ['--verbose', '--progress'];
        if (options?.force) {
            opts.push('--force');
        }
        if (options?.remote && options?.upstream) {
            if (options.setUpstream) {
                opts.push('--set-upstream');
            }
            branch = `${branch}:${options.upstream}`;
        }
        try {
            Logger().debug('SimpleGitBackend', 'Push with options', {
                options: opts,
                remote: options?.remote,
                branch: branch,
            });
            // this._git.outputHandler((command, stdout, stderr) => {
            //     stdout.on('data', (chunk: Buffer) =>
            //         options?.onProgress?.('TODO', chunk.toString())
            //     );
            //     stderr.on('data', (chunk: Buffer) =>
            //         options?.onProgress?.('TODO', chunk.toString())
            //     );
            // });
            // this.events.next({
            //     event: 'progress-started',
            //     id: id,
            //     message: `Pushing changes to upstream`,
            // });
            await this._git.push(options?.remote, branch, opts);
            Logger().info('SimpleGitBackend', 'Finished without exception');
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Could not push changes to upstream', {
                error: e.toString(),
                where: e.stack || 'No stack trace available',
                options: options,
            });
            toast.error(
                structuredToast(`Could not push changes to upstream`, e.toString().split('\n')),
                {
                    autoClose: false,
                }
            );
        } finally {
            // this.events.next({
            //     event: 'progress-finished',
            //     id: id,
            //     message: `Finished pushing to upstream`,
            // });
            this._git.outputHandler(undefined);
        }
    };

    fetch = async (options: {
        remote: Maybe<string>;
        branch: Maybe<string>;
        prune: boolean;
    }): Promise<void> => {
        const opts = ['--verbose', '--progress'];
        if (options.prune) {
            opts.push('--prune');
        }
        const id = nanoid();
        try {
            //     this._git.outputHandler((command, stdout, stderr) => {
            //         stdout.on('data', (chunk: Buffer) =>
            //             options.onProgress?.('TODO', chunk.toString())
            //         );
            //         stderr.on('data', (chunk: Buffer) =>
            //             options.onProgress?.('TODO', chunk.toString())
            //         );
            // }
            // this.events.next({
            //     event: 'progress-started',
            //     id: id,
            //     message: `Fetching ${options?.remote ? 'from ' + options.remote : 'all remotes'}.`,
            // });
            const cmd = ['fetch'];
            options.prune && cmd.push('--prune');
            options.remote.found && cmd.push(options.remote.value);
            options.branch.found && cmd.push(options.branch.value);
            await this._git.raw(cmd);
        } finally {
            // this.events.next({
            //     event: 'progress-finished',
            //     id: id,
            //     message: `Finished fetching ${
            //         options?.remote ? 'from ' + options.remote : 'all remotes'
            //     }.`,
            // });
            this._git.outputHandler(undefined);
        }
    };

    pull = async (remote: string, remoteBranch: string, noFF: boolean): Promise<void> => {
        try {
            // this.events.next({
            //     event: 'progress-started',
            //     id: 'test',
            //     message: `Pulling from ${remote}/${remoteBranch}`,
            // });
            await this._git.pull(remote, remoteBranch, noFF ? ['--no-ff'] : undefined);
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Pulling from remote branch failed', {
                error: e,
                remote: remote,
                remoteBranch: remoteBranch,
                noFF: noFF,
            });
            toast(structuredToast('Failed to pull remote changes', e.message?.split(/\n/)), {
                type: 'error',
                autoClose: false,
            });
        } finally {
            // this.events.next({
            //     event: 'progress-finished',
            //     id: 'test',
            //     message: `Finished pulling from ${remote}/${remoteBranch}`,
            // });
        }
    };

    init = async (path: string): Promise<void> => {
        await this.open(path);
        await this._git.init();
    };

    clone = async (url: string, dir: string): Promise<void> => {
        const id = nanoid();
        try {
            // this.events.next({
            //     event: 'progress-started',
            //     message: `Cloning ${url} to ${dir}`,
            //     id: id,
            // });
            const git = simpleGit(); // clone is one of the few commands, that can actually be executed without an open local repo
            const result = await git.clone(url, dir);
        } catch (e) {
            toast(structuredToast(`Failed to clone ${url} to ${dir}`, e.message?.split(/\n/)), {
                type: 'error',
                autoClose: false,
            });
            Logger().error('SimpleGiteBackend', 'Clone failed', { url, dir, error: e });
        } finally {
            // this.events.next({
            //     event: 'progress-finished',
            //     message: `Finished cloning ${url} to ${dir}`,
            //     id: id,
            // });
        }
    };

    branch = async (name: string, source: string, noCheckout: boolean): Promise<void> => {
        try {
            if (noCheckout) {
                await this._git.raw(['branch', name, source]);
            } else {
                await this._git.checkoutBranch(name, source);
            }
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Creating branch failed', { error: e });
        }
    };

    renameBranch = async (oldName: string, newName: string): Promise<void> => {
        await this._git.raw(['branch', '-m', oldName, newName]);
    };

    deleteBranch = async (
        branch: BranchInfo,
        force: boolean,
        removeRemote: boolean
    ): Promise<void> => {
        try {
            if (!branch.remote) {
                await this._git.raw(['branch', force ? '-D' : '-d', branch.ref]);
                if (removeRemote) {
                    await this._git.push(branch.upstream?.remoteName, branch.upstream?.ref, [
                        '--delete',
                    ]);
                }
            } else {
                await this._git.push(branch.remote, branch.ref, ['--delete']);
            }
        } catch (e) {
            Logger().error('SimpleGitBackend', 'Deleting branch failed', { error: e });
        }
    };

    getUnmergedBranches = async (name: Maybe<string>): Promise<Maybe<string[]>> => {
        const source = name.found ? [name.value] : [];
        return fromNullable(await (await this._git.branch(['--no-merged'].concat(source)))?.all);
    };

    merge = async (from: string, noFF: boolean) => {
        const options = noFF ? ['--no-ff'] : [];
        const mergeResult = await this._git.merge(options.concat(from));
        Logger().debug('SimpleGitBackend', 'Finished merge', { result: mergeResult });
        return mergeResult?.failed ? mergeResult.result : undefined;
    };

    getPendingCommitMessage = () => {
        const msg = fs.readFileSync(path.join(this.dir, '.git', 'MERGE_MSG'));
        return msg.toLocaleString();
    };

    stash = async (message: string, untracked: boolean) => {
        const msgOpts = message.length !== 0 ? ['push', '-m', message] : [];
        const untrackedOpts = untracked ? ['-u'] : [];
        Logger().debug('SimpleGitBackend', 'Stashing options', {
            options: msgOpts.concat(untrackedOpts),
        });
        const result = await this._git.stash(msgOpts.concat(untrackedOpts));
        Logger().info('SimpleGitBackend', 'Stashed changes with result', { result: result });
    };

    listStashes = async (): Promise<readonly Stash[]> => {
        Logger().silly('SimpleGitBackend', 'Trying to list stashes');
        const stashOutput = await this._git.raw([
            'stash',
            'list',
            '-z',
            '--pretty=format:%H|--/%h|--/%s|--/%aN|--/%aE|--/%ai|--/%P|--/%p|--/%gd',
        ]);
        const stashList = stashOutput
            ?.split('\0')
            .map((entry) => entry.split('|--/'))
            .filter((e) => e.length === 9);
        Logger().debug('SimpleGitBackend', 'Received stash list', {
            stashes: stashList,
        });
        return (
            stashList?.map((entry) => {
                const longParents = entry[6].split(/\s+/);
                const shortParents = entry[7].split(/\s+/);
                return {
                    type: 'stash',
                    ref: entry[8],
                    oid: entry[0],
                    short_oid: entry[1],
                    message: entry[2],
                    parents: longParents.map((p, index) => ({
                        oid: p,
                        short_oid: shortParents[index],
                    })),
                    author: {
                        name: entry[3],
                        email: entry[4],
                        timestamp: new Date(entry[5]),
                    },
                };
            }) || []
        );
    };

    getStashDetails = async (stash: Stash): Promise<CommitStats> => {
        Logger().debug('SimpleGitBackend', 'Requested details for stash', { stash: stash });
        const wcStats = await this._stashGetWCChanges(stash);
        const untrackedStats = await this._stashGetUntracked(stash);
        return {
            commit: stash,
            direct: wcStats.concat(untrackedStats),
            incoming: nothing,
        };
    };

    private _stashGetWCChanges = async (stash: Stash): Promise<readonly DiffStat[]> => {
        Logger().debug('SimpleGitBackend', 'Getting stashed working-copy changes');
        const workingCopyStatusResult = await this._git.raw([
            'stash',
            'show',
            '--name-status',
            '-z',
            stash.oid,
        ]);
        const wcStatusFields = workingCopyStatusResult?.split('\0').slice(0, -1);
        const workingCopyChangesResult = await this._git.raw([
            'stash',
            'show',
            '--numstat',
            '-z',
            stash.oid,
        ]);
        const wcChangesFields = workingCopyChangesResult
            ?.split('\0')
            .slice(0, -1)
            .map((entry) => entry.split(/\s+/));
        Logger().debug('SimpleGitBackend', 'Received working copy stats and changes', {
            status: wcStatusFields,
            changes: wcChangesFields,
        });
        if (wcStatusFields && wcChangesFields) {
            const chunkedStatus = chunks(wcStatusFields, 2);
            const matched = chunkedStatus.map((s) => {
                const change = wcChangesFields?.find((c) => c[2] === s[1]); //filenames come last in the split fields
                const stat: DiffStat = {
                    path: change?.[2] ?? '<invalid path>',
                    status: mapCommitStatus(s[0]),
                    additions: parseInt(change?.[0] ?? '0'),
                    deletions: parseInt(change?.[1] ?? '0'),
                };
                return stat;
            });
            Logger().debug('SimpleGitBackend', `Working copy changes for stash ${stash.oid}`, {
                stats: matched,
            });
            return matched;
        }
        Logger().error(
            'SimpleGitBackend',
            `Could not get stats for stash ${stash.oid}. At least one stats command failed.`,
            { status: wcStatusFields, changes: wcChangesFields }
        );
        return [];
    };

    private _stashGetUntracked = async (stash: Stash): Promise<readonly DiffStat[]> => {
        if (stash.parents.length === 3) {
            const untrackedCommit: Commit = {
                ...stash,
                type: 'commit',
                oid: stash.parents[2].oid,
                parents: [],
                committer: stash.author,
            };
            const stats = await this.getCommitStats(untrackedCommit);
            return stats.direct.map((entry) => ({
                ...entry,
                source: 'untracked',
                status: 'untracked',
            }));
        }
        return [];
    };

    applyStash = async (stash: Stash, deleteAfterApply: boolean): Promise<void> => {
        await this._git.raw(['stash', deleteAfterApply ? 'pop' : 'apply', stash.ref]);
    };

    dropStash = async (stash: Stash): Promise<void> => {
        await this._git.raw(['stash', 'drop', stash.ref]);
    };

    reset = async (branch: string, toRef: string, mode: string): Promise<void> => {
        await this._git.reset([`--${mode}`, toRef]);
    };

    createTag = async (tag: string, ref: string, message: Maybe<string>): Promise<void> => {
        if (message.found) {
            Logger().debug('SimpleGitBackend', 'Creating annotated tag', {
                tag,
                ref,
                message: message.value,
            });
            await this._git.raw(['tag', '-a', '-m', message.value, tag, ref]);
        } else {
            Logger().debug('SimpleGitBackend', 'Creating lightweight tag', { tag, ref });
            await this._git.raw(['tag', tag, ref]);
        }
    };

    deleteTag = (tag: Tag): Promise<string> => this._git.raw(['tag', '-d', tag.name]);

    getFiles = async (): Promise<string[]> => {
        const fileResult = await this._git.raw(['ls-files', '-z']);
        return fileResult.split(/\0/);
    };

    blame = async (path: string): Promise<readonly BlameInfo[]> => {
        const blameString = await this._git.raw(['blame', '--line-porcelain', path]);
        const lines = blameString.split(/\n/);
        let result = [] as readonly BlameInfo[];
        Logger().silly('GitBackend', 'Received raw blame info', { output: lines });
        for (let i = 0; i < lines.length - 1; i++) {
            // don't parse the last line. It's an artifact of .split() anyway
            const meta: any = {};
            const commit = lines[i].match(
                /(?<oid>[0-9a-z]+)\s+[0-9]+\s+[0-9]+\s*(?<numlines>[0-9]+)*/
            );
            meta.commit = commit?.groups?.oid;
            i++;
            do {
                const match = lines[i]?.match(/(?<name>[^\s]+)\s(?<value>.*)/);
                meta[match?.groups?.name ?? '<unknown>'] = match?.groups?.value;
                i++;
            } while (lines[i] && !lines[i].startsWith('\t'));
            if (result.length > 0 && result[result.length - 1].oid === meta.commit) {
                result[result.length - 1].content = result[result.length - 1].content.concat([
                    lines[i].substr(1),
                ]);
            } else {
                result = result.concat([
                    {
                        oid: meta.commit,
                        author: meta['author'],
                        mail: meta['author-mail'],
                        timestamp: new Date(parseInt(meta['author-time']) * 1000),
                        summary: meta['summary'],
                        content: [lines[i].substr(1)],
                    },
                ]);
            }
        }
        return result;
    };

    getConfig = async (): Promise<IGitConfig> => {
        const config = await this._git.listConfig();
        Logger().debug('SimpleGitBackend', 'Got config', { config: config });
        const localFile = config.files.find((f) => f.startsWith('.git'));
        const userFile = config.files.find((f) => f.startsWith(homedir()));
        const local = localFile ? config.values[localFile] : undefined;
        const user = userFile ? config.values[userFile] : undefined;
        return {
            local: local && this.transformGitFlowConfig(local, this.transformConfig(local)),
            global: user && this.transformConfig(user),
        };
    };

    private transformConfig = (input: ConfigValues): IEffectiveConfig => {
        const ret: IEffectiveConfig = {};
        if (input['user.name'] || input['user.email']) {
            ret.user = {
                name: input['user.name'] as string,
                email: input['user.email'] as string,
            };
            Logger().silly('GitBackend', 'Found user information', { user: ret.user });
        }
        return ret;
    };

    private transformGitFlowConfig(
        input: ConfigValues,
        existing: IGitConfigValues
    ): IGitConfigValues & IGitFlowConfig {
        if (input['gitflow.branch.master']) {
            return {
                ...existing,
                gitFlow: {
                    branch: {
                        master: input['gitflow.branch.master']?.toString(),
                        develop: input['gitflow.branch.develop']?.toString(),
                    },
                    prefix: {
                        feature: input['gitflow.prefix.feature']?.toString(),
                        bugfix: input['gitflow.prefix.bugfix']?.toString(),
                        release: input['gitflow.prefix.release']?.toString(),
                        hotfix: input['gitflow.prefix.hotfix']?.toString(),
                        support: input['gitflow.prefix.support']?.toString(),
                        versiontag: input['gitflow.prefix.versiontag']?.toString(),
                    },
                },
            };
        }
        return existing;
    }

    setConfigVariable = async (variable: string, value: string): Promise<void> => {
        await this._git.addConfig(variable, value);
    };

    restore = async (path: string): Promise<void> => {
        Logger().silly('SimpleGitBackend', 'Restoring path', { path: path });
        await this._git.raw(['restore', '--', path]);
        Logger().silly('SimpleGitBackend', 'Restored path', { path: path });
    };

    addRemote = async (name: string, url: string): Promise<void> => {
        Logger().debug('SimpleGitBackend', 'Adding new remote', { name, url });
        await this._git.addRemote(name, url);
        Logger().debug('SimpleGitBackend', 'Success');
    };

    updateRemote = async (name: string, url: string): Promise<void> => {
        Logger().debug('SimpleGitBackend', 'Updating remote', { name, url });
        await this._git.raw(['remote', 'set-url', name, url]);
        Logger().debug('SimpleGitBackend', 'Success');
    };

    deleteRemote = async (name: string): Promise<void> => {
        Logger().debug('SimpleGitBackend', 'Delete remote', { name });
        await this._git.removeRemote(name);
        Logger().debug('SimpleGitBackend', 'Success');
    };

    rebase = async (
        target: string,
        commands?: readonly { action: string; commit: Commit }[]
    ): Promise<void> => {
        Logger().debug('SimpleGitBackend.rebase', 'Rebasing current branch', { target });
        if (commands) {
            try {
                const script = await createCommandScript(commands);
                Logger().silly('SimpleGitBackend.rebase', 'Interactively rebasing commits', {
                    commands,
                });
                // spawn git with the custom editor by hand
                const result = await execAsync(`git rebase -i ${target}`, {
                    cwd: this.dir,
                    env: {
                        ...process.env,
                        GIT_SEQUENCE_EDITOR: script,
                        GIT_EDITOR: 'true',
                    },
                });
                Logger().debug('SimpleGitBackend.rebase', 'Successfully rebased commits', result);
            } finally {
                temp.cleanup();
            }
        } else {
            await this._git.rebase([target]);
        }
        Logger().debug('SimpleGitBackend.rebase', 'Success');
    };

    getRebaseStatus = async (): Promise<Maybe<RebaseStatusInfo>> => {
        try {
            const rebaseMergePath = (
                await this._git.raw(['rev-parse', '--git-path', 'rebase-merge'])
            ).replace(/\n/, '');
            const todoString = await readFileAsync(
                `${this.dir}/${rebaseMergePath}/git-rebase-todo`,
                'utf8'
            );
            const doneString = await readFileAsync(`${this.dir}/${rebaseMergePath}/done`, 'utf8');
            const patch = await this._git.raw(['rebase', '--show-current-patch']);
            const todo = await Promise.all(todoString.split('\n').map(this.parseRebaseAction));
            const done = await Promise.all(doneString.split('\n').map(this.parseRebaseAction));
            return just({
                todo,
                patch,
                done,
            });
        } catch (e) {
            Logger().silly('SimpleGitBasend.getRebaseStatus', 'Could not load rebase status', {
                error: e,
            });
            return nothing;
        }
    };

    private parseRebaseAction = async (line: string): Promise<RebaseAction> => {
        const [action, id] = line.split(/\s+/);
        return {
            action,
            commit: await this.getCommit(id),
        };
    };

    abortRebase = async (): Promise<void> => {
        await this._git.rebase(['--abort']);
    };

    getAffectedRefs = async (
        ref: string,
        branches: boolean,
        tags: boolean,
        commits: boolean
    ): Promise<{ branches: string[]; tags: string[]; refs: string[] }> => {
        const refs: { branches: string[]; tags: string[]; refs: string[] } = {
            branches: [],
            tags: [],
            refs: [],
        };
        if (branches) {
            const br = await this._git.raw(['branch', '--contains', ref, '--format=%(refname)']);
            Logger().silly('getAffectedRefs', 'Raw branches string', { output: br });
            refs.branches = br.split('\n').map((b) => b.replace('refs/heads/', '')); // we only care about the actual branch name
        }
        if (tags) {
            const tgs = await this._git.raw(['tag', '--contains', ref]);
            Logger().silly('getAffectedRefs', 'Raw tags string', { output: tgs });
            refs.tags = tgs.split('\n');
        }
        if (commits) {
            throw new Error('Not implemented yet');
        }
        Logger().debug('getAffectedRefs', 'Returning affected refs', { affected: refs });
        return refs;
    };
}

function parseFileStatus(
    status: string,
    source: string | undefined = undefined
): readonly DiffStat[] {
    const fileStatusFields = status?.split('\0').filter((field) => field !== '');
    Logger().debug('parseFileStatus', 'Split result', { status: status, split: fileStatusFields });
    const fileStatus: DiffStat[] = [];
    if (fileStatusFields) {
        const length = fileStatusFields.length;
        for (let i = 0; i < length; i += 2) {
            let oldPath: string | undefined = undefined;
            let path = fileStatusFields[i + 1];
            const status = mapCommitStatus(fileStatusFields[i]);
            if (status === 'renamed') {
                oldPath = fileStatusFields[i + 1];
                path = fileStatusFields[i + 2];
                i++;
            }
            fileStatus.push({
                source: source,
                path: path,
                oldPath: oldPath,
                status: status,
                additions: 0,
                deletions: 0,
            });
        }
    }
    return fileStatus;
}

function mergeNumStats(result: string, fileStatus: readonly DiffStat[]): void {
    const diffFields = result?.split('\0');
    if (diffFields) {
        const length = diffFields.length;
        for (let i = 0; i < length; i++) {
            const entryFields = diffFields[i].split(/\s+/);
            let path = entryFields[entryFields.length - 1];
            if (path.length === 0) {
                // if the entry is a move, the filename is NOT contained in the field itself, but rather follows
                // in the next field and the field after that
                path = diffFields[i + 2];
                i += 2;
            }
            const fileStat = fileStatus.find((fs) => fs.path === path);
            if (fileStat) {
                fileStat.additions = parseInt(entryFields[0]);
                fileStat.deletions = parseInt(entryFields[1]);
            }
        }
    }
}

/**
 * Map the status string of a file to our internal status type
 *
 * @param output The output of the git status command
 */
function mapCommitStatus(output: string): DiffStatus {
    if (output.length === 0) {
        return 'unmodified';
    }
    switch (output[0]) {
        case 'A':
            return 'added';
        case 'R':
            return 'renamed';
        case 'D':
            return 'deleted';
        case 'M':
            return 'modified';
        case 'U':
            return 'conflict';
        case '?':
            return 'untracked';
        case ' ':
            return 'unmodified';
        default:
            Logger().error('SimpleGitBackend', `Don't know how to map "${output}"`);
            return 'unknown';
    }
}

/**
 * Create a temporary script to modify the interactive rebase command file based on
 * user UI input.
 *
 * @param commands The commands to serialize in the interactive rebase command script
 */
async function createCommandScript(
    commands: readonly { action: string; commit: Commit }[]
): Promise<string> {
    const commandScript = commands
        .map((command) => `${command.action} ${command.commit.short_oid}`)
        .join('\n');
    const commandFile = await tempOpenAsync({ prefix: 'rebase', suffix: '.sh' });
    await writeAsync(
        commandFile.fd,
        `#!/bin/sh

cat <<COMMANDS > $1
${commandScript}
COMMANDS
`
    );
    fs.chmodSync(commandFile.path, 0o500);
    fs.closeSync(commandFile.fd);
    return commandFile.path;
}
