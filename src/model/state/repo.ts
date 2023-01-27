import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import AsyncLock from 'async-lock';
import { castDraft } from 'immer';
import { useQuery, UseQueryResult } from 'react-query';
import createHook from 'zustand';
// import produce from 'immer';
import { immer } from 'zustand/middleware/immer';
import create from 'zustand/vanilla';
import { GitBackend } from '../../util/GitBackend';
import { Logger } from '../../util/logger';
import { just, Maybe, nothing } from '../../util/maybe';
import { queryClient } from '../../util/queryClient';
import { getDiff } from '../actions/repo';
import { GitConfigValue, IGitConfig, IGitConfigValues, NamedGitConfigValue } from '../IGitConfig';
import {
    BranchInfo, Commit, CommitStats, PendingCommit, RebaseStatusInfo, RemoteMeta, Stash, Tag
} from '../stateObjects';

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
     * The status of the current ongoing rebase, if any
     */
    rebaseStatus: Maybe<RebaseStatusInfo>;
    /**
     * The pending commit, if any
     */
    pendingCommit: Maybe<PendingCommit>;
    /**
     * The currently selected commit, if any
     */
    selectedCommit: Maybe<CommitStats>;
    /**
     * The refs affected by a specific commit.
     */
    affected: { branches: string[]; tags: string[]; refs: string[] };
};

export type RepoActions = {
    openRepo(path: string): Promise<void>;
    loadRepo(): Promise<void>;
    loadHistory(skip?: number, limit?: number): Promise<void>;
    setHistory(history: HistoryInfo): void;
    setSelectedCommit(commit: Maybe<CommitStats>): void;
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
        history: { entries: [], total: 0, first: 0 },
        path: '',
        pendingCommit: nothing,
        selectedCommit: nothing,
        status: [],
        rebaseStatus: nothing,
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
            ];
            await Promise.all(loaders);
            performance.mark('loadersEnd');
            performance.measure('loaders', 'loadersStart', 'loadersEnd');
        },
        loadHistory: async (skip?: number, limit?: number): Promise<void> => {
            // Logger().debug('loadHistory', 'Getting total history size');
            // const size = await get().backend.getHistorySize();
            // Logger().debug('loadHistory', 'Loading history');
            // let index = 0;
            // let history: readonly Commit[] = [];
            // if (get().historyLoader) {
            //     (window as any).cancelIdleCallback(get().historyLoader);
            // }
            // const batchSize = 20;
            // const partLoader = async () => {
            //     const historyPart = await get().backend.getHistory(undefined, index, batchSize);
            //     if (historyPart.length > 0) {
            //         Logger().debug('loadHistory', 'Received partial history from backend', {
            //             items: historyPart.length,
            //         });
            //         history = [...history, ...historyPart];
            //         set((state) => {
            //             Logger().silly('loadHistory', 'Setting history state');
            //             state.history = {
            //                 entries: castDraft(history),
            //                 first: 0,
            //                 total: size,
            //             };
            //             return state;
            //         });
            //         index += batchSize;
            //     }
            //     if (historyPart.length === batchSize) {
            //         const handle = (window as any).requestIdleCallback(partLoader);
            //         set((state) => {
            //             state.historyLoader = handle;
            //             return state;
            //         });
            //     }
            // };
            // partLoader();
        },
        setHistory: (history: HistoryInfo) => {
            set(state => {
                state.history = castDraft(history);
                return state;
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

export const useConfig = (): UseQueryResult<IGitConfig> => 
    useQuery('config', async () => {
        const configValues = await invoke<NamedGitConfigValue<string>[]>('get_config');
        console.log("Got config:", configValues);
        return {
            user: {
               name: configValues.find(c => c.name === "user.name"),
               email: configValues.find(c => c.name === "user.email")
            }
        }
    });


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
    useQuery('tags', () => invoke<readonly Tag[]>('get_tags')).data ?? [];

listen('tags_changed', (_) => queryClient.invalidateQueries('tags'));

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

listen('stashes-changed', (_) => queryClient.invalidateQueries('stashes'));

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
    useQuery('branches', () => {
        return invoke<readonly BranchInfo[]>('get_branches', {})
    });

listen('branches-changed', _ => {
    Logger().debug('branches-changed', 'Invalidating branches query');
    queryClient.invalidateQueries('branches');
});


/**
 * Get the current branch
 */
export const useCurrentBranch = (): BranchInfo | undefined => {
    const { data: branches } = useBranches();
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
 * Query the diff of a specific file
 */
export function useDiff(source: 'commit' | 'stash' | 'index' | 'workdir', path: string, commit?: string, parent?: string, untracked?: boolean) {
    return useQuery(['diff', commit, path, source, parent, untracked], () => getDiff({
        source,
        commitId: commit,
        toParent: parent,
        path,
        untracked
    }));
}
listen<{commit?: string, path?: string, source: 'commit' | 'stash' | 'index' | 'workdir', parent?: string, untracked?: boolean}>('diff-changed', ev => {
    Logger().debug('diff-changed', 'Diff changed', { paylod: ev.payload });
});

/**
 * =================================================
 * handlers for events from the backend
 * =================================================
 */
listen<HistoryInfo>('historyChanged', ev => {
    repoStore.getState().setHistory(ev.payload);
})

listen<CommitStats>('commitStatsChanged', ev => {
    console.log("Got new commit stats", ev.payload);
    repoStore.getState().setSelectedCommit(just(ev.payload));
});
