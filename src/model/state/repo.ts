import { GitBackend } from '../../util/GitBackend';
import {
    Commit,
    BranchInfo,
    RemoteMeta,
    Tag,
    IndexStatus,
    PendingCommit,
    Stash,
    CommitStats,
    RebaseStatusInfo,
} from '../stateObjects';
import { Maybe, nothing, just, fromNullable } from '../../util/maybe';
import { IGitConfig } from '../IGitConfig';
import { Middleware } from './types';
import create from 'zustand/vanilla';
import createHook from 'zustand';
// import produce from 'immer';
import { immer } from 'zustand/middleware/immer';
import { log } from './log';
import { Logger } from '../../util/logger';
// import fs from 'fs';
import * as path from '@tauri-apps/api/path';
import AsyncLock from 'async-lock';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { castDraft } from 'immer';
import { queryClient } from '../../util/queryClient';
import { useQuery, UseQueryResult } from 'react-query';

/**
 * Information about the git history
 */
export interface HistoryInfo {
    /**
     * the total number of history entries
     */
    total: number;
    /**
     * The currently loaded entries
     */
    entries: readonly Commit[];
    /**
     * The index of the first loaded entry in the overall history
     */
    first: number;
}

export type RepoState = {
    /**
     * indicates, that this repository is active, i.e. correctly set up with a backend directory
     */
    active: boolean;
    /**
     * the currently opened path
     */
    path: string;
    /**
     * The current git backend connected to this repo
     */
    backend: GitBackend;
    /**
     * The history of the currently opened repository
     */
    history: HistoryInfo;
    /**
     * The branches of this repository
     */
    branches: readonly BranchInfo[];
    /**
     * The known remotes
     */
    remotes: readonly RemoteMeta[];
    /**
     * The tags in this repo
     */
    tags: readonly Tag[];

    /**
     * The status of the current ongoing rebase, if any
     */
    rebaseStatus: Maybe<RebaseStatusInfo>;
    /**
     * The pending commit, if any
     */
    pendingCommit: Maybe<PendingCommit>;
    /**
     * The stashes in this repo
     */
    stashes: readonly Stash[];
    /**
     * The currently selected commit, if any
     */
    selectedCommit: Maybe<CommitStats>;
    /**
     * The configuration of the repository
     */
    config: IGitConfig;
    /**
     * The refs affected by a specific commit.
     */
    affected: { branches: string[]; tags: string[]; refs: string[] };
};

export type RepoActions = {
    openRepo(path: string): Promise<void>;
    loadRepo(): Promise<void>;
    loadHistory(skip?: number, limit?: number): Promise<void>;
    setBranches(branches: BranchInfo[]): void;
    setHistory(history: HistoryInfo): void;
    loadTags(): Promise<void>;
    loadStashes(): Promise<void>;
    loadRemotes(): Promise<void>;
    getConfig(): Promise<void>;
    setSelectedCommit(commit: Maybe<CommitStats>): void;
    selectStash(stash: Stash): Promise<void>;
    /**
     * The asynchronous lock used to synchronize critical operations on this repo
     */
    lock: AsyncLock;
    historyLoader: any;
};

export const repoStore = create<RepoState & RepoActions>()(
    immer((set, get) => ({
        active: false,
        backend: (undefined as unknown) as GitBackend, // TODO: I hate this
        branches: [],
        config: {},
        history: { entries: [], total: 0, first: 0 },
        path: '',
        pendingCommit: nothing,
        remotes: [],
        selectedCommit: nothing,
        stashes: [],
        status: [],
        rebaseStatus: nothing,
        tags: [],
        files: nothing,
        historyLoader: undefined,
        lock: new AsyncLock(),
        affected: { branches: [], tags: [], refs: [] },
        openRepo: (path: string): Promise<void> => {
            Logger().debug('openRepo', 'Opening repo', { path });
            invoke('git_open', { path });
            set(
                (state) => ({
                    ...state,
                    active: true,
                    // TODO
                    // backend: new SimpleGitBackend(path),
                    branches: [],
                    config: {},
                    history: { entries: [], total: 0, first: 0 },
                    historySize: 0,
                    path: path,
                    pendingCommit: nothing,
                    remotes: [],
                    selectedCommit: nothing,
                    stashes: [],
                    status: [],
                    rebaseStatus: nothing,
                    tags: [],
                    files: nothing,
                    historyLoader: undefined,
                    lock: new AsyncLock(),
                    affected: { branches: [], tags: [], refs: [] },
                }),
                true
            );
            return Promise.resolve();
        },
        loadRepo: async (): Promise<void> => {
            performance.mark('loadersStart');
            const loaders = [
                get().loadHistory(),
                get().loadTags(),
                get().loadStashes(),
                get().loadRemotes(),
                get().getConfig(),
            ];
            await Promise.all(loaders);
            performance.mark('loadersEnd');
            performance.measure('loaders', 'loadersStart', 'loadersEnd');
        },
        loadHistory: async (skip?: number, limit?: number): Promise<void> => {
            Logger().debug('loadHistory', 'Getting total history size');
            const size = await get().backend.getHistorySize();
            Logger().debug('loadHistory', 'Loading history');
            let index = 0;
            let history: readonly Commit[] = [];
            if (get().historyLoader) {
                (window as any).cancelIdleCallback(get().historyLoader);
            }
            const batchSize = 20;
            const partLoader = async () => {
                const historyPart = await get().backend.getHistory(undefined, index, batchSize);
                if (historyPart.length > 0) {
                    Logger().debug('loadHistory', 'Received partial history from backend', {
                        items: historyPart.length,
                    });
                    history = [...history, ...historyPart];
                    set((state) => {
                        Logger().silly('loadHistory', 'Setting history state');
                        state.history = {
                            entries: castDraft(history),
                            first: 0,
                            total: size,
                        };
                        return state;
                    });
                    index += batchSize;
                }
                if (historyPart.length === batchSize) {
                    const handle = (window as any).requestIdleCallback(partLoader);
                    set((state) => {
                        state.historyLoader = handle;
                        return state;
                    });
                }
            };
            partLoader();
        },
        setBranches: (branches: BranchInfo[]): void => {
            Logger().debug('setBranches', 'Setting branches');
            Logger().debug('loadBranches', 'Success.', { branches });
            set((state) => {
                state.branches = branches;
                return state;
            });
        },
        setHistory: (history: HistoryInfo) => {
            set(state => {
                state.history = castDraft(history);
                return state;
            });
        },
        loadTags: async (): Promise<void> => {
            Logger().debug('loadTags', 'Loading tags');
            const tags = await get().backend.getTags();
            Logger().debug('loadTags', 'Received tags', { tags: tags });
            set((state) => {
                state.tags = castDraft(tags);
            });
        },
        loadStashes: async (): Promise<void> => {
            Logger().debug('loadStashes', 'Attempting to load stashes');
            const stashes = await get().backend.listStashes();
            Logger().debug('loadStashes', 'Success', {
                stashes: stashes,
            });
            set((state) => {
                state.stashes = castDraft(stashes);
            });
        },
        loadRemotes: async (): Promise<void> => {
            Logger().debug('loadRemotes', 'Loading remotes');
            const remotes = await get().backend.getRemotes();
            Logger().debug('loadRemotes', 'Success.', { remotes: remotes });
            set((state) => {
                state.remotes = remotes;
            });
        },
        getConfig: async (): Promise<void> => {
            Logger().debug('getConfig', 'Loading repository config');
            const config = await get().backend.getConfig();
            Logger().silly('getConfig', 'Sucessfully loaded config', {
                config: config,
            });
            set((state) => {
                state.config = config;
            });
        },
        setSelectedCommit: (commit: Maybe<CommitStats>): void => {
            set((state) => {
                state.selectedCommit = castDraft(commit);
            });
        },
        deselectCommit: (): void => {
            set((state) => {
                state.selectedCommit = nothing;
            });
        },
        selectStash: async (stash: Stash): Promise<void> => {
            Logger().debug('selectStash', 'Requested loading stats for stash', {
                stash: stash,
            });
            const stats = await get().backend.getStashDetails(stash);
            Logger().debug('selectStash', 'Received stash details', { stats: stats });
            // await get().selectCommit(stats);
        },
        getRebaseStatus: async (): Promise<void> => {
            Logger().debug('getRebaseStatus', 'Checking for rebase in progress');
            const status = await get().backend.getRebaseStatus();
            Logger().debug('getRebaseStatus', 'Received status', { status });
            set((state) => {
                // state.rebaseStatus = status;
            });
        },
    }))
);

export const useRepo = createHook(repoStore);

/**
 * Access the history of the repo
 */
export const useHistory = (): { entries: readonly Commit[]; first: number; total: number } =>
    useRepo(
        (
            state: RepoState & RepoActions
        ): { entries: readonly Commit[]; first: number; total: number } => state.history
    );

/**
 * Get the current available tags in the repo
 */
export const useTags = (): readonly Tag[] =>
    useRepo((state: RepoState & RepoActions) => state.tags);

/**
 * Get the current available remotes in the repo
 */
export const useRemotes = (): readonly RemoteMeta[] =>
    useQuery('remotes', () => invoke<readonly RemoteMeta[]>('get_remotes')).data ?? [];

/**
 * Get the current available stashes in the repo
 */
export const useStashes = (): UseQueryResult<readonly Stash[]> =>
    useQuery('stashes', () => invoke<readonly Stash[]>('get_stashes'));

listen('stashed_changed', (_) => queryClient.invalidateQueries('get_stashes'));

/**
 * Get the current state of the index
 */
export const useConfig = (): IGitConfig =>
    useRepo((state: RepoState & RepoActions) => state.config);

/**
 * get the current pending commit (e.g. after a failed merge)
 */
export const usePendingCommit = (): Maybe<PendingCommit> =>
    useRepo((state: RepoState & RepoActions) => state.pendingCommit);

/**
 * get the currently selected commit (e.g. for displaying commit details)
 */
export const useSelectedCommit = (): Maybe<CommitStats> =>
    useRepo((state: RepoState & RepoActions) => state.selectedCommit);

/**
 * get the branches affected by/containing the currently selected commit 
 */
export function useAffectedBranches(): string[] {
    const selectedCommit = useSelectedCommit();
    const { data } = useQuery(['affected_branches', selectedCommit],
        async () => {
            if (selectedCommit.found && selectedCommit.value.type === 'commit') {
                return await invoke<string[]>('get_affected_branches', { oid: selectedCommit.value.commit.oid });
            }
            return [];
        });
    return data ?? [];
}

/**
 * Get the current available branches in the repo (local and remote)
 */
export const useBranches = (): UseQueryResult<readonly BranchInfo[]> => 
    useQuery('branches', () => invoke<readonly BranchInfo[]>('get_branches', {}));

/**
 * Get the current branch
 */
export const useCurrentBranch = (): BranchInfo | undefined => {
    const { data: branches  } = useBranches();
    return branches?.find(b => b.current);
}

/**
 * get the current pending commit (e.g. after a failed merge)
 */
export const useRebaseStatus = (): Maybe<RebaseStatusInfo> =>
    useRepo((state: RepoState & RepoActions) => state.rebaseStatus);

/**
 * Get the commit stats for the given commit.
 * 
 * @param commit The commit for which to return the stats
 * @returns The CommitStats for the commit
 */
export const loadCommitStats = (commit: Commit): Promise<CommitStats> => repoStore.getState().backend.getCommitStats(commit);


/**
 * =================================================
 * handlers for events from the backend
 * =================================================
 */
listen<BranchInfo[]>('branchesChanged', ev => {
    queryClient.invalidateQueries('branches');
});

listen<HistoryInfo>('historyChanged', ev => {
    repoStore.getState().setHistory(ev.payload);
})

listen<CommitStats>('commitStatsChanged', ev => {
    console.log("Got new commit stats", ev.payload);
    repoStore.getState().setSelectedCommit(just(ev.payload));
});