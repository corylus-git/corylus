import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { useQuery, UseQueryResult } from 'react-query';
import { queryClient } from '../../util/queryClient';
import { IndexStatus } from '../stateObjects';

export type IndexActions = {
    loadStatus: () => Promise<void>;
}

export type IndexState = {
    /**
     * The current state of the index
     */
    status: readonly IndexStatus[];
};

export const INDEX_QUERY = 'index';
export const INDEX_QUERY_FN = () => invoke<IndexStatus[]>('get_status');

export function useIndex(): UseQueryResult<IndexStatus[]> {
    return useQuery(INDEX_QUERY, INDEX_QUERY_FN);
}

/**
 * Get the current conflicts in the repository
 *
 * @returns true if there are conflicts, false otherwise
 */
export const useConflicts = (): boolean =>
    useIndex().data?.find((s) => s.isConflicted) !== undefined;

listen('status-changed', () => queryClient.invalidateQueries('index'));
