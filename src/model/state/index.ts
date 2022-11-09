import create from 'zustand/vanilla';
import createHook from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { IndexStatus } from '../stateObjects';
import { castDraft } from 'immer';
import { invoke } from '@tauri-apps/api/tauri';
import { Logger } from '../../util/logger';
import { Event, listen } from '@tauri-apps/api/event';

export type IndexActions = {
    loadStatus: () => Promise<void>;
}

export type IndexState = {
    /**
     * The current state of the index
     */
    status: readonly IndexStatus[];
};

export const indexStore = create<IndexState & IndexActions>()(
    immer((set, _) => ({
        status: [],
        loadStatus: async () => {
            try {
                const status = await invoke<IndexStatus[]>('get_status');
                set((state) => {
                    state.status = castDraft(status);
                });
            }
            catch (error) {
                Logger().error('indexStore#loadStatus', 'Could not load status', { error });
            }
        }
    })),
);

export const useIndex = createHook(indexStore);

/**
 * Get the current conflicts in the repository
 *
 * @returns true if there are conflicts, false otherwise
 */
export const useConflicts = (): boolean =>
    useIndex(
        (state: IndexState & IndexActions) => state.status.find((s) => s.isConflicted) !== undefined
    );

listen('status-changed', () => indexStore.getState().loadStatus());