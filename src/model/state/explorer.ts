import { Maybe, nothing, just } from '../../util/maybe';
import { FileStats, Commit, BlameInfo, DiffStatus } from '../stateObjects';
import create from 'zustand/vanilla';
import createHook from 'zustand';
import { Middleware } from './types';
import produce from 'immer';
import { Logger } from '../../util/logger';
import { repoStore } from './repo';
import { log } from './log';

export type ExplorerState = {
    /**
     * currently listed files, if any
     */
    files: Maybe<readonly FileStats[]>;
    /**
     * The path of the file the history entries belong to
     */
    filePath: Maybe<string>;
    /**
     * the currently open file history, if any
     */
    fileHistory: Maybe<readonly Commit[]>;
    /**
     * The currently loaded blame
     */
    blameInfo: Maybe<readonly BlameInfo[]>;
};

export type ExplorerActions = {
    loadWorkdir: () => Promise<void>;
    loadPathHistory: (path: string) => Promise<void>;
    closePathHistory: () => void;
    loadBlameInfo: (path: string) => Promise<void>;
    closeBlameInfo: () => void;
    reset: () => void;
};

// Turn the set method into an immer proxy
const immer: Middleware<ExplorerState & ExplorerActions> = (config) => (set, get, api) =>
    config((fn: any) => set(produce(fn)), get, api);

export const explorer = create(
    log(
        immer((set) => ({
            blameInfo: nothing,
            fileHistory: nothing,
            filePath: nothing,
            files: nothing,
            loadWorkdir: async (): Promise<void> => {
                Logger().debug('loadWorkdir', 'Loading working directory state');
                const status = await repoStore.getState().backend.getStatus();
                const files = await repoStore.getState().backend.getFiles();
                Logger().silly('loadWorkdir', 'Received file entries', { status, files });
                const fullStatus: readonly FileStats[] = files
                    .filter((f) => status.findIndex((s) => s.path === f) === -1)
                    .map((f) => ({
                        path: f,
                        status: 'unmodified' as DiffStatus,
                    }))
                    .concat(
                        status.map((s) => ({
                            path: s.path,
                            status: s.workdirStatus,
                        }))
                    );
                set((state) => {
                    state.files = just(fullStatus);
                });
            },
            loadPathHistory: async (path: string): Promise<void> => {
                Logger().debug('loadPathHistory', 'Loading history for path', { path });
                const history = await repoStore.getState().backend.getHistory(path);
                Logger().debug('loadPathHistory', 'Received history from backend', {
                    items: history.length,
                });
                set((state) => {
                    Logger().silly('loadPathHistory', 'Setting history state');
                    state.fileHistory = just(history);
                    state.filePath = just(path);
                });
            },
            closePathHistory: (): void => {
                set((state) => {
                    state.fileHistory = nothing;
                    state.filePath = nothing;
                });
            },
            loadBlameInfo: async (path: string): Promise<void> => {
                Logger().debug('loadBlameInfo', 'Loading blame info for file', { path: path });
                const blame = await repoStore.getState().backend.blame(path);
                Logger().silly('loadBlameInfo', 'Received blame info', { info: blame });
                set((state) => {
                    state.blameInfo = just(blame);
                    state.filePath = just(path);
                });
            },
            closeBlameInfo: (): void => {
                set((state) => {
                    state.blameInfo = nothing;
                    state.filePath = nothing;
                });
            },
            reset: (): void => {
                set((state) => {
                    state.files = nothing;
                    state.filePath = nothing;
                    state.fileHistory = nothing;
                    state.blameInfo = nothing;
                });
            },
        }))
    )
);

export const useExplorer = createHook(explorer);

export const useFiles = (): Maybe<readonly FileStats[]> => useExplorer((s) => s.files);

export const useFileHistory = (): Maybe<readonly Commit[]> => useExplorer((s) => s.fileHistory);

export const useFilePath = (): Maybe<string> => useExplorer((s) => s.filePath);

export const useBlameInfo = (): Maybe<readonly BlameInfo[]> => useExplorer((s) => s.blameInfo);
