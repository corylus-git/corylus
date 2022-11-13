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
    repositoryHistory: Map<string, Date>;

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
        repositoryHistory: new Map<string, Date>(),
        updateHistory: (path: string) => {
            
        },
        load: async () => {
            const data = await invoke<any>('get_settings');
            set(state => {
                state.openTabs = data.openTabs;
                state.theme = data.theme;
                const s = data.repositoryHistory as { path: string; date: number }[];
                const map = new Map<string, Date>();
                s?.forEach((e) => map.set(e.path, new Date(e.date)));
                state.repositoryHistory = map;
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
