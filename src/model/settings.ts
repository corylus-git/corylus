import create from 'zustand/vanilla';
import { Logger } from '../util/logger';
import { invoke } from '@tauri-apps/api';
import { immer } from 'zustand/middleware/immer';
import { basename } from '@tauri-apps/api/path';
import { useQuery } from 'react-query';
import { trackError } from '../util/error-display';
import { listen } from '@tauri-apps/api/event';
import { queryClient } from '../util/queryClient';

export interface HistoryEntry {
    path: string;
    title: string;
    date: number;
}

/**
 * The settings known to the program
 */
export interface SettingsState {
    /**
     * The paths of the tabs currently open
     */
    openTabs: string[];

    /**
     * Repositories that were opened in the past
     *
     * key: the path of the repository
     * value: the last time this repo was open
     */
    repositoryHistory: HistoryEntry[];

    /**
     * The name of the theme currently in use by the app
     */
    theme: string;
}

export interface SettingsActions {
    /**
     * Update the given entry in the repository history.
     * If the path already exists, update its access date, otherwise add it to
     * the history
     *
     * @param path The path to add to the history
     */
    updateHistory(path: string): Promise<void>;

    load(): Promise<void>;
}

// class SettingsImpl implements ISettings {
//     async load() {

//     }

//     updateHistory(path: string) {
//         const currentHistory = this.repositoryHistory;
//         currentHistory.set(path, new Date(Date.now()));
//         if (currentHistory.size >= 100) {
//             const remainingEntries = Array.from(currentHistory.entries());
//             remainingEntries.sort(([_, date1], [__, date2]) => date2.getDate() - date1.getDate());
//             currentHistory.clear();
//             remainingEntries.forEach(([repoPath, date]) => currentHistory.set(repoPath, date));
//         }
//         this.repositoryHistory = currentHistory;
//     }
// }

const DEFAULT_SETTINGS = {
    openTabs: [],
    theme: 'dark',
    repositoryHistory: []
};

export const useSettings = () => {
    return useQuery('settings', async () => invoke<SettingsState>('get_settings'), { staleTime: Infinity, cacheTime: Infinity })?.data ?? DEFAULT_SETTINGS;
}

listen('settings-changed', (_) => queryClient.invalidateQueries('settings'));

export const updateSettings = trackError('updateSettings', 'update settings',
    async (newSettings: SettingsState): Promise<void> => {
        const backendSettings = await invoke<SettingsState>('update_settings', { settings: newSettings });
        queryClient.setQueryData('settings', backendSettings);
    }
);

export const updateHistory = trackError('updateHistory', 'update history', 
    async (path: string) => {
        await invoke('update_history', { path });
    }
);

