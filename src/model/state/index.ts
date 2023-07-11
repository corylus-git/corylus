import { invoke } from '@tauri-apps/api/tauri';
import { useQuery, UseQueryResult } from 'react-query';
import { queryClient } from '../../util/queryClient';
import { listen } from '../../util/typesafeListen';
import { IndexStatus } from '../stateObjects';
import { Logger } from '../../util/logger';

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
    Logger().silly('useIndex', 'Attempting to get index');
    return useQuery(INDEX_QUERY, INDEX_QUERY_FN);
}

/**
 * Get the current conflicts in the repository
 *
 * @returns true if there are conflicts, false otherwise
 */
export const useConflicts = (): boolean =>
    useIndex().data?.find((s) => s.isConflicted) !== undefined;

listen('StatusChanged', () => queryClient.invalidateQueries('index'));
