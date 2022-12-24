import { tabsStore } from './state/tabs';
import createHook from 'zustand';
import create from 'zustand/vanilla';
import { allActivePaths } from './state/util';
import { themeStore } from './state/theme';
import { darkTheme } from '../style/dark-theme';
import { Logger } from '../util/logger';
import { Theme } from '../style/theme';
import { invoke } from '@tauri-apps/api';
import { immer } from 'zustand/middleware/immer';
import { basename } from '@tauri-apps/api/path';
import { castDraft } from 'immer';

export interface HistoryEntry {
    path: string; 
    title: string; 
    date: Date;
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
    updateHistory(path: string): void;

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

export const settingsStore = create<SettingsState & SettingsActions>()(
    immer((set, get) => ({
        openTabs: [],
        theme: "dark",
        repositoryHistory: [],
        updateHistory: (path: string) => {

        },
        load: async () => {
            const data = await invoke<any>('get_settings');
            const s = data.repositoryHistory as { path: string; date: number }[];
            const history = await Promise.all(s.map(async ({ path, date }) => ({
                path,
                date: new Date(date),
                title: await basename(path)
            })));
            set(state => {
                state.openTabs = data.openTabs;
                state.theme = data.theme;
                state.repositoryHistory = castDraft(history);
            })
        }
    })),
);

export const useSettings = createHook(settingsStore);

export function startAppSettingsStorage(): void {
    // TODO
    // tabsStore.subscribe(
    //     (tabs: string[] | null) => (appSettings().openTabs = tabs ?? []),
    //     (s) => allActivePaths(s)
    // );
    // themeStore.subscribe(
    //     (theme: string | null) => {
    //         Logger().debug('appSettingsStorage', 'Syncing new theme to settings', { theme });
    //         appSettings().theme = theme ?? darkTheme.name;
    //     },
    //     (s) => s.current.name
    // );
}
