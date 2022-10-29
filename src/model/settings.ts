import { tabsStore } from './state/tabs';
import { allActivePaths } from './state/util';
import { themeStore } from './state/theme';
import { darkTheme } from '../style/dark-theme';
import { Logger } from '../util/logger';
import { Theme } from '../style/theme';

/**
 * The settings known to the program
 */
export interface ISettings {
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
     * Update the given entry in the repository history.
     * If the path already exists, update its access date, otherwise add it to
     * the history
     *
     * @param path The path to add to the history
     */
    updateHistory(path: string): void;

    /**
     * The name of the theme currently in use by the app
     */
    theme: string;
}

class SettingsImpl implements ISettings {
    constructor() {
        // TODO temporary workaround because electron-settings is not compatible with enableRemoteModule: false
        // settings.configure({ dir: app.getPath('userData') });
    }

    get openTabs() {
        return [];
        // return (settings.getSync('openTabs') as string[]) ?? [];
    }
    set openTabs(tabs: string[]) {
        // settings.setSync('openTabs', tabs);
    }
    private _repositoryHistory: Map<string, Date> | undefined = undefined;

    get repositoryHistory() {
        return new Map<string, Date>();
        // if (!this._repositoryHistory) {
        //     const s = settings.getSync('repositoryHistory') as { path: string; date: number }[];
        //     const map = new Map<string, Date>();
        //     s?.forEach((e) => map.set(e.path, new Date(e.date)));
        //     this._repositoryHistory = map;
        // }
        // return this._repositoryHistory;
    }
    set repositoryHistory(history: Map<string, Date>) {
        // settings.setSync(
        //     'repositoryHistory',
        //     Array.from(history.entries()).map(([path, date]) => ({
        //         path,
        //         date: date.getTime(),
        //     }))
        // );
    }

    updateHistory(path: string) {
        const currentHistory = this.repositoryHistory;
        currentHistory.set(path, new Date(Date.now()));
        if (currentHistory.size >= 100) {
            const remainingEntries = Array.from(currentHistory.entries());
            remainingEntries.sort(([_, date1], [__, date2]) => date2.getDate() - date1.getDate());
            currentHistory.clear();
            remainingEntries.forEach(([repoPath, date]) => currentHistory.set(repoPath, date));
        }
        this.repositoryHistory = currentHistory;
    }

    get theme(): string {
        return darkTheme.name;
        // return (settings.getSync('theme') as string) ?? darkTheme.name;
    }

    set theme(theme: string) {
        // settings.setSync('theme', theme);
    }
}

export function appSettings(): ISettings {
    if (_appSettings === undefined) {
        _appSettings = new SettingsImpl();
    }
    return _appSettings;
}

let _appSettings: ISettings | undefined = undefined;

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
