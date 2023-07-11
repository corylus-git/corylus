import { invoke } from '@tauri-apps/api/tauri';
import AsyncLock from 'async-lock';
import { castDraft } from 'immer';
import { QueryOptions, useQuery, UseQueryResult } from 'react-query';
import { loggers } from 'winston';
import createHook from 'zustand';
// import produce from 'immer';
import { immer } from 'zustand/middleware/immer';
import create from 'zustand/vanilla';
import { Logger } from '../../util/logger';
import { fromNullable, just, Maybe, nothing } from '../../util/maybe';
import { queryClient } from '../../util/queryClient';
import { listen } from '../../util/typesafeListen';
import { getDiff } from '../actions/repo';
import { GitConfigValue, IGitConfig, IGitConfigValues, NamedGitConfigValue } from '../IGitConfig';
import {
    BranchInfo, Commit, CommitStats, PendingCommit, RebaseStatusInfo, RemoteMeta, StashData, Tag
} from '../stateObjects';
import { SelectedConflict, SelectedFile } from './stagingArea';

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
     * The history of the currently opened repository
     */
    history: HistoryInfo;
    /**
     * The status of the current ongoing rebase, if any
     */
    rebaseStatus: Maybe<RebaseStatusInfo>;
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
        openRepo: async (path: string): Promise<void> => {
            Logger().debug('openRepo', 'Opening repo', { path });
            await invoke('git_open', { path });
            queryClient.invalidateQueries();
            await invoke('load_repo', {});
            set(
                (state) => ({
                    ...state,
                    active: true,
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
        }
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

export function loadRepo(path: string) {
    return invoke('git_open', { path });
}

/**
 * Get the number of commits in the repo
 * 
 * @returns the number of commits in the repo
 */
export const useHistorySize = () => useQuery('historySize', () => invoke<number>('get_history_size', {}));

listen('HistoryChanged', (_) => queryClient.invalidateQueries('historySize'));

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

listen('TagsChanged', (_) => queryClient.invalidateQueries('tags'));

/**
 * Get the current available remotes in the repo
 */
export const useRemotes = () =>
    useQuery('remotes', () => invoke<readonly RemoteMeta[]>('get_remotes'));

/**
 * Get the current available stashes in the repo
 */
export const useStashes = (): UseQueryResult<readonly StashData[]> =>
    useQuery('stashes', getStashes);

listen('StashesChanged', (_) => queryClient.invalidateQueries('stashes'));


/**
 * Retrieves stash data from the backend.
 */
export async function getStashes(): Promise<readonly StashData[]> {
    return invoke<readonly StashData[]>('get_stashes')
}

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
    useQuery('branches', async () => {
        const branches = await invoke<readonly BranchInfo[]>('get_branches', {});
        Logger().debug('useBranches:query', 'Received branches from the backend.', { branches });
        return branches;
    });

listen('BranchesChanged', _ => {
    Logger().debug('branches-changed', 'Invalidating branches query');
    queryClient.invalidateQueries('branches');
});


/**
 * Get the current branch
 */
export const useCurrentBranch = () => {
    const branches = useBranches();
    return useQuery(['current_branch', branches.data], async () => branches.data?.find(b => b.current));
}

/**
 * get the current pending commit (e.g. after a failed merge)
 */
export const useRebaseStatus = (): Maybe<RebaseStatusInfo> => {
    const { data } = useQuery('rebase_status', () => invoke<RebaseStatusInfo>('rebase_status', {}));
    Logger().debug('useRebaseStatus', `Rebase status ${data}`);
    return fromNullable(data);
}

export function useMergeStatus() {
    const result = useQuery('is_merge', () => invoke<boolean>('is_merge', {}));
    Logger().debug('useMergeStatus', `Merge status ${result.data}`);
    return result.data;
}
listen('RepoStateChanged', () => {
    queryClient.invalidateQueries('is_rebase');
    queryClient.invalidateQueries('is_merge');
});

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
listen<{ commit?: string, path?: string, source: 'commit' | 'stash' | 'index' | 'workdir', parent?: string, untracked?: boolean }>('DiffChanged', ev => {
    Logger().debug('diff-changed', 'Diff changed', { paylod: ev.payload });
    queryClient.invalidateQueries(['diff', ev.payload.commit, ev.payload.path, ev.payload.source, ev.payload.parent, ev.payload.untracked]);
});
export function invalidateDiffQuery(source: 'commit' | 'stash' | 'index' | 'workdir', path: string, commit?: string, parent?: string, untracked?: boolean) {
    queryClient.invalidateQueries(['diff', commit, path, source, parent, untracked]);
}

export function useHead() {
    return useCommit('HEAD');
}

export function useMergeHead() {
    return useCommit('HEAD^');
}

export function useCommit(ref: string | undefined) {
    return useQuery(['commit', ref], () => invoke<Commit>('get_commit', { refNameOrOid: ref }), { enabled: !!ref });
}

export function useMergeMessage() {
    return useQuery(['merge_message'], getMergeMessage);
}
listen('MergeMessageChanged', ev => queryClient.invalidateQueries(['merge_message']));

export function getMergeMessage() {
    return invoke<string | undefined>('get_merge_message', {});
}

/**
 * =================================================
 * handlers for events from the backend
 * =================================================
 */
listen<HistoryInfo>('HistoryChanged', ev => {
    repoStore.getState().setHistory(ev.payload);
})

listen<CommitStats>('CommitStatsChanged', ev => {
    console.log("Got new commit stats", ev.payload);
    repoStore.getState().setSelectedCommit(just(ev.payload));
});
