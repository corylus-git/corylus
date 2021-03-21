import settings from 'electron-settings';
import { tabsStore } from './state/tabs';
import { allActivePaths } from './state/util';
import { themeStore } from './state/theme';
import { darkTheme } from '../style/dark-theme';
import { Logger } from '../util/logger';

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
}

class SettingsImpl implements ISettings {
    get openTabs() {
        return (settings.getSync('openTabs') as string[]) ?? [];
    }
    set openTabs(tabs: string[]) {
        settings.setSync('openTabs', tabs);
    }
    private _repositoryHistory: Map<string, Date> | undefined = undefined;

    get repositoryHistory() {
        if (!this._repositoryHistory) {
            const s = settings.getSync('repositoryHistory') as { path: string; date: number }[];
            const map = new Map<string, Date>();
            s?.forEach((e) => map.set(e.path, new Date(e.date)));
            this._repositoryHistory = map;
        }
        return this._repositoryHistory;
    }
    set repositoryHistory(history: Map<string, Date>) {
        settings.setSync(
            'repositoryHistory',
            Array.from(history.entries()).map(([path, date]) => ({
                path,
                date: date.getTime(),
            }))
        );
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
        return (settings.getSync('theme') as string) ?? darkTheme.name;
    }

    set theme(theme: string) {
        settings.setSync('theme', theme);
    }
}

export const appSettings = new SettingsImpl();

export function startAppSettingsStorage(): void {
    tabsStore.subscribe(
        (tabs: string[] | null) => (appSettings.openTabs = tabs ?? []),
        (s) => allActivePaths(s)
    );
    themeStore.subscribe(
        (theme: string | null) => {
            Logger().debug('appSettingsStorage', 'Syncing new theme to settings', { theme });
            appSettings.theme = theme ?? darkTheme.name;
        },
        (s) => s.current.name
    );
}
