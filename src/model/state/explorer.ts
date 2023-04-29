import { invoke } from '@tauri-apps/api';
import { castDraft } from 'immer';
import { useQuery, UseQueryResult } from 'react-query';
import createHook from 'zustand';
import { immer } from 'zustand/middleware/immer';
import create from 'zustand/vanilla';
import { GraphLayoutData, LayoutListEntry } from '../../util/graphLayout';
import { Logger } from '../../util/logger';
import { just, Maybe, nothing } from '../../util/maybe';
import { BlameInfo, Commit, DiffStatus, FileStats } from '../stateObjects';
import { repoStore } from './repo';

// export type ExplorerState = {
//     /**
//      * currently listed files, if any
//      */
//     files: Maybe<readonly FileStats[]>;
//     /**
//      * The path of the file the history entries belong to
//      */
//     filePath: Maybe<string>;
//     /**
//      * the currently open file history, if any
//      */
//     fileHistory: Maybe<readonly Commit[]>;

//     fileHistoryGraph?: readonly LayoutListEntry[]; 
//     /**
//      * The currently loaded blame
//      */
//     blameInfo: Maybe<readonly BlameInfo[]>;
// };

// export type ExplorerActions = {
//     loadWorkdir: () => Promise<void>;
//     loadPathHistory: (path: string) => Promise<void>;
//     closePathHistory: () => void;
//     loadBlameInfo: (path: string) => Promise<void>;
//     closeBlameInfo: () => void;
//     reset: () => void;
// };

// export const explorer = create<ExplorerState & ExplorerActions>()(
//     immer((set) => ({
//         blameInfo: nothing,
//         fileHistory: nothing,
//         filePath: nothing,
//         files: nothing,
//         fileHistoryGraph: undefined,
//         loadWorkdir: async (): Promise<void> => {
//             Logger().debug('loadWorkdir', 'Loading working directory state');
//             const status = await repoStore.getState().backend.getStatus();
//             const files = await repoStore.getState().backend.getFiles();
//             Logger().silly('loadWorkdir', 'Received file entries', { status, files });
//             const fullStatus: readonly FileStats[] = files
//                 .filter((f) => status.findIndex((s) => s.path === f) === -1)
//                 .map((f) => ({
//                     path: f,
//                     status: 'unmodified' as DiffStatus,
//                 }))
//                 .concat(
//                     status.map((s) => ({
//                         path: s.path,
//                         status: s.workdirStatus,
//                     }))
//                 );
//             set((state) => {
//                 state.files = castDraft(just(fullStatus));
//             });
//         },
//         loadPathHistory: async (path: string): Promise<void> => {
//             Logger().debug('loadPathHistory', 'Loading history for path', { path });
//             const history = await invoke<GraphLayoutData>('get_graph', { pathspec: path });
//             Logger().debug('loadPathHistory', 'Received history from backend', {
//                 items: history.lines.length,
//             });
//             set((state) => {
//                 Logger().silly('loadPathHistory', 'Setting history state');
//                 state.fileHistory = castDraft(just(history.lines.map(e => e.commit)));
//                 state.fileHistoryGraph = castDraft(history.lines);
//                 state.filePath = just(path);
//             });
//         },
//         closePathHistory: (): void => {
//             set((state) => {
//                 state.fileHistory = nothing;
//                 state.filePath = nothing;
//             });
//         },
//         loadBlameInfo: async (path: string): Promise<void> => {
//             Logger().debug('loadBlameInfo', 'Loading blame info for file', { path: path });
//             const blame = await repoStore.getState().backend.blame(path);
//             Logger().silly('loadBlameInfo', 'Received blame info', { info: blame });
//             set((state) => {
//                 state.blameInfo = castDraft(just(blame));
//                 state.filePath = just(path);
//             });
//         },
//         closeBlameInfo: (): void => {
//             set((state) => {
//                 state.blameInfo = nothing;
//                 state.filePath = nothing;
//             });
//         },
//         reset: (): void => {
//             set((state) => {
//                 state.files = nothing;
//                 state.filePath = nothing;
//                 state.fileHistory = nothing;
//                 state.blameInfo = nothing;
//             });
//         },
//     }))
// );

// export const useExplorer = createHook(explorer);

export const useFiles = (commit?: string): UseQueryResult<readonly FileStats[]> =>
    useQuery(['files', commit], () => invoke<readonly FileStats[]>('get_files', { commit }));

export const useFileHistory = (): Maybe<readonly Commit[]> => nothing;

export const useFileHistoryGraph = (): readonly LayoutListEntry[] | undefined => undefined;

export const useFilePath = (): Maybe<string> => nothing;

export const useBlameInfo = (): Maybe<readonly BlameInfo[]> => nothing;
