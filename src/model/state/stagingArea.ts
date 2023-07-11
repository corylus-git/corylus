import * as path from '@tauri-apps/api/path';
import { castDraft } from 'immer';
import createHook from 'zustand';
import { immer } from 'zustand/middleware/immer';
import create from 'zustand/vanilla';
import { calculateBlocks, IConflictBlock } from '../../components/Merging/util/blocks';
import { IConflictedFile, parseConflictFile } from '../../util/conflict-parser';
import { FileDiff } from '../../util/diff-parser';
import { splice } from '../../util/ImmutableArrayUtils';
import { Logger } from '../../util/logger';
import { just, Maybe, nothing } from '../../util/maybe';
import { Commit, IndexStatus } from '../stateObjects';
import { repoStore } from './repo';
import { invoke } from '@tauri-apps/api';

export interface SelectedFile {
    path: string;
    source: 'workdir' | 'index';
    untracked: boolean;
    conflicted: boolean;
}

export interface SelectedConflict {
    file: IndexStatus;
    ours: Commit;
    theirs: Commit;
}

export interface ManualMergeState {
    path: string;
    blocks: readonly IConflictBlock[];
}

export type StagingAreaState = {
    selectedDiff: Maybe<FileDiff>;
    selectedFile: Maybe<SelectedFile>;
    selectedConflict: Maybe<SelectedConflict>;
    manualMerge: Maybe<ManualMergeState>;
    /**
     * The state of the commit form
     */
    commitFormState: { message: string; amend: boolean };
};

export type StagingAreaActions = {
    loadDiff: (source: 'workdir' | 'index', path: string) => Promise<void>;
    deselectDiff: () => void;
    selectConflictedFile: (file: IndexStatus) => Promise<void>;
    deselectConflictedFile: () => void;
    requestManualMerge: (filePath: string) => Promise<void>;
    toggleBlock: (side: 'ours' | 'theirs', index: number) => void;
    finishManualMerge: () => void;
    reset: () => void;
    setCommitFormState(message: string, amend: boolean): void;
};

export const stagingArea = create<StagingAreaState & StagingAreaActions>()(
    immer((set, get) => ({
        selectedDiff: nothing,
        selectedFile: nothing,
        selectedConflict: nothing,
        manualMerge: nothing,
        commitFormState: { message: '', amend: false },
        deselectDiff: (): void => {
            set((state) => {
                state.selectedDiff = nothing;
                state.selectedFile = nothing;
            });
        },
        loadDiff: async (source: 'workdir' | 'index', p: string): Promise<void> => {

            // const isNewFile =
            //     useIndex().data?.find((f) => f.path === p)?.workdirStatus ===
            //     'untracked';
            // if (source === 'workdir' && isNewFile) {
            //     await repoStore.getState().lock.acquire('git', async () => {
            //         // this is a completely new file -> load it as a pseudo diff as if the file was added completely
            //         await repoStore.getState().backend.addPath(p, true);
            //         const diff = await invoke<FileDiff[]>('get_diff', { source: 'workdir', path: p });
            //         await repoStore.getState().backend.resetPath(p);
            //         set((state) => {
            //             state.selectedDiff = castDraft(just(diff[0]));
            //             // state.selectedDiff = just(diff);
            //             state.selectedFile = just({
            //                 path: p,
            //                 source: source,
            //             });
            //         });
            //     });
            // } else {
            //     const result = await invoke<FileDiff[]>('get_diff', { source: source, path: p });
            //     if (result) {
            //         set((state) => {
            //             state.selectedDiff = castDraft(just(result[0]));
            //             state.selectedFile = just({
            //                 path: p,
            //                 source: source,
            //             });
            //         });
            //     } else {
            //         get().deselectDiff();
            //     }
            // }
        },
        selectConflictedFile: async (file: IndexStatus): Promise<void> => {
            Logger().debug('selectConflictedFile', 'Selecting conflicted file for display', {
                file,
            });
            throw new Error('Not ported to Tauri yet');
            // const ours = await repoStore.getState().backend.getCommit('HEAD');
            // try {
            //     const theirs = await repoStore.getState().backend.getCommit('MERGE_HEAD');
            //     set((state) => {
            //         state.selectedConflict = just({ ours: ours, theirs: theirs, file: file });
            //     });
            // } catch {
            //     // generate pseudo commit with changes from the marge index
            //     set((state) => {
            //         // state.selectedConflict = castDraft(just({
            //         //     ours,
            //         //     theirs: {
            //         //         type: 'stash',
            //         //         author: {
            //         //             name: '',
            //         //             email: '',
            //         //             timestamp: new Date(),
            //         //         },
            //         //         message: '',
            //         //         oid: '',
            //         //         parents: [],
            //         //         ref: 'stash',
            //         //         shortOid: 'stash',
            //         //     },
            //         //     file: file,
            //         // }));
            //     });
            // }
        },
        deselectConflictedFile: (): void => {
            set((state) => {
                state.selectedConflict = nothing;
            });
        },
        requestManualMerge: async (filePath: string): Promise<void> => {
            const conflict = await loadConflict(filePath);
            Logger().debug('requestManualMerge', 'Parsed conflict', conflict);
            // const file = await path.join(repoStore.getState().backend.dir, filePath);
            // const conflict = await loadConflict(file);
            const blocks = calculateBlocks(
                conflict.lines.map((l) => ({
                    ...l,
                    oursSelected: false,
                    theirsSelected: false,
                }))
            );
            set((state) => {
                state.manualMerge = castDraft(just({
                    blocks,
                    path: filePath,
                }));
            });
        },
        toggleBlock: (side: 'ours' | 'theirs', index: number): void => {
            set((state) => {
                if (state.manualMerge.found) {
                    Logger().debug('toggleBlock', 'Toggling conflict block selection', {
                        side,
                        index,
                    });
                    const b = state.manualMerge.value.blocks[index];
                    const replacementBlock = {
                        ...b,
                        oursSelected: side === 'ours' ? !b.oursSelected : b.oursSelected,
                        theirsSelected:
                            side === 'theirs' ? !b.theirsSelected : b.theirsSelected,
                    };
                    state.manualMerge.value.blocks = castDraft(splice(
                        state.manualMerge.value.blocks,
                        index,
                        1,
                        replacementBlock
                    ));
                }
            });
        },
        finishManualMerge: (): void => {
            Logger().debug('finishManualMerge', 'Closing Merge panel');
            set((state) => {
                state.manualMerge = nothing;
                state.selectedConflict = nothing;
            });
        },
        reset: (): void => {
            Logger().debug('reset', 'Resetting staging area state');
            set((state) => {
                state.selectedDiff = nothing;
                state.selectedFile = nothing;
                state.selectedConflict = nothing;
                state.manualMerge = nothing;
                state.commitFormState = { message: '', amend: false };
            });
        },
        setCommitFormState: (message, amend): void => {
            console.error("Called setCommitFormState", message, amend);
            set((state) => {
                state.commitFormState = {
                    message, amend
                };
            });
        }
    }))
);

async function loadConflict(path: string): Promise<IConflictedFile> {
    const conflictString = await invoke<string | undefined>('get_conflicts', { path });
    Logger().silly('loadConflict', 'Loaded merged file contents', {
        content: conflictString,
    });
    const parsedLines = parseConflictFile(conflictString || '');
    Logger().silly('loadConflict', 'Parsed conflict', { lines: parsedLines });
    return {
        path: path,
        lines: parsedLines,
    };

    // return await new Promise((resolve) => {
    //     // TODO
    //     // fs.readFile(path, (err, buffer) => {
    //     //     const fileContents = buffer.toString();
    //     //     Logger().silly('loadConflict', 'Loaded merged file contents', {
    //     //         content: fileContents,
    //     //     });
    //     //     const parsedLines = parseConflictFile(fileContents);
    //     //     Logger().silly('loadConflict', 'Parsed conflict', { lines: parsedLines });
    //     //     resolve({
    //     //         path: path,
    //     //         lines: parsedLines,
    //     //     });
    //     // });
    // });
}

export const useStagingArea = createHook(stagingArea);

