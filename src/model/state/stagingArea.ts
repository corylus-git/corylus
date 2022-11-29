import { IndexStatus, Commit, Stash } from '../stateObjects';
import { IConflictBlock, calculateBlocks } from '../../components/Merging/util/blocks';
import { Maybe, nothing, just } from '../../util/maybe';
import create from 'zustand/vanilla';
import createHook from 'zustand';
import { Middleware } from './types';
import produce, { castDraft } from 'immer';
import { log } from './log';
import { repoStore } from './repo';
import { Logger } from '../../util/logger';
import { IConflictedFile, parseConflictFile } from '../../util/conflict-parser';
import * as path from '@tauri-apps/api/path';
import { splice } from '../../util/ImmutableArrayUtils';
import { immer } from 'zustand/middleware/immer';
import { FileDiff } from '../../util/diff-parser';
import { invoke } from '@tauri-apps/api';
import { UseQueryResult } from 'react-query';
import { useIndex } from '.';

export interface SelectedFile {
    path: string;
    source: 'workdir' | 'index';
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
};

export const stagingArea = create<StagingAreaState & StagingAreaActions>()(
    immer((set, get) => ({
        selectedDiff: nothing,
        selectedFile: nothing,
        selectedConflict: nothing,
        manualMerge: nothing,
        deselectDiff: (): void => {
            set((state) => {
                state.selectedDiff = nothing;
                state.selectedFile = nothing;
            });
        },
        loadDiff: async (source: 'workdir' | 'index', p: string): Promise<void> => {

            const isNewFile =
                useIndex().data?.find((f) => f.path === p)?.workdirStatus ===
                'untracked';
            if (source === 'workdir' && isNewFile) {
                await repoStore.getState().lock.acquire('git', async () => {
                    // this is a completely new file -> load it as a pseudo diff as if the file was added completely
                    await repoStore.getState().backend.addPath(p, true);
                    const diff = await invoke<FileDiff[]>('get_diff', { source: 'workdir', path: p });
                    await repoStore.getState().backend.resetPath(p);
                    set((state) => {
                        state.selectedDiff = castDraft(just(diff[0]));
                        // state.selectedDiff = just(diff);
                        state.selectedFile = just({
                            path: p,
                            source: source,
                        });
                    });
                });
            } else {
                const result = await invoke<FileDiff[]>('get_diff', { source: source, path: p });
                if (result) {
                    set((state) => {
                        state.selectedDiff = castDraft(just(result[0]));
                        state.selectedFile = just({
                            path: p,
                            source: source,
                        });
                    });
                } else {
                    get().deselectDiff();
                }
            }
        },
        selectConflictedFile: async (file: IndexStatus): Promise<void> => {
            Logger().debug('selectConflictedFile', 'Selecting conflicted file for display', {
                file,
            });
            const ours = await repoStore.getState().backend.getCommit('HEAD');
            try {
                const theirs = await repoStore.getState().backend.getCommit('MERGE_HEAD');
                set((state) => {
                    state.selectedConflict = just({ ours: ours, theirs: theirs, file: file });
                });
            } catch {
                // generate pseudo commit with changes from the marge index
                set((state) => {
                    state.selectedConflict = castDraft(just({
                        ours,
                        theirs: {
                            type: 'stash',
                            author: {
                                name: '',
                                email: '',
                                timestamp: new Date(),
                            },
                            message: '',
                            oid: '',
                            parents: [],
                            ref: 'stash',
                            shortOid: 'stash',
                        },
                        file: file,
                    }));
                });
            }
        },
        deselectConflictedFile: (): void => {
            set((state) => {
                state.selectedConflict = nothing;
            });
        },
        requestManualMerge: async (filePath: string): Promise<void> => {
            Logger().silly(
                'requestManualMerge',
                'Manual merge requested. Loading file content.',
                {
                    file: filePath,
                }
            );
            const file = await path.join(repoStore.getState().backend.dir, filePath);
            const conflict = await loadConflict(file);
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
            set((state) => {
                state.selectedDiff = nothing;
                state.selectedFile = nothing;
                state.selectedConflict = nothing;
                state.manualMerge = nothing;
            });
        },
    }))
);

async function loadConflict(path: string): Promise<IConflictedFile> {
    return await new Promise((resolve) => {
        // TODO
        // fs.readFile(path, (err, buffer) => {
        //     const fileContents = buffer.toString();
        //     Logger().silly('loadConflict', 'Loaded merged file contents', {
        //         content: fileContents,
        //     });
        //     const parsedLines = parseConflictFile(fileContents);
        //     Logger().silly('loadConflict', 'Parsed conflict', { lines: parsedLines });
        //     resolve({
        //         path: path,
        //         lines: parsedLines,
        //     });
        // });
    });
}

export const useStagingArea = createHook(stagingArea);
