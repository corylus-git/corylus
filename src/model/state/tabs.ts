import { basename } from '@tauri-apps/api/path';
import { castDraft } from 'immer';
import { nanoid } from 'nanoid';
import createHook from 'zustand';
import { immer } from 'zustand/middleware/immer';
import create from 'zustand/vanilla';
import { Logger } from '../../util/logger';
import { updateHistory, updateTabs } from '../settings';
import { repoStore } from './repo';
import { stagingArea } from './stagingArea';

export interface TabState {
    /**
     * The unique identifier used for this tab
     */
    id: string;
    /**
     * The title of this tab
     */
    title: string;
    /**
     * The path displayed in this tab
     */
    path: string | null;
}

export type TabsState = {
    /**
     * all currently open tabs
     */
    tabs: readonly TabState[];
    /**
     * The id of active tab
     */
    active: string | null;
};

export type TabsActions = {
    addTab: () => void;
    closeTab: (id: string) => void;
    switchTab: (tab: TabState) => void;
    openRepoInActive: (path: string) => void;
    openRepoInNew: (path: string) => void;
    loadTabs: (tabs: readonly TabState[]) => void;
};

export const tabsStore = create<TabsState & TabsActions>()(
    immer((set, get) => ({
        tabs: [] as readonly TabState[],
        active: null,
        addTab: (): void => {
            set((state) => {
                Logger().debug('addTab', 'Opening new tab');
                const tab: TabState = {
                    id: `tab-${nanoid()}`,
                    path: null,
                    title: '(New Tab)',
                };
                const tabs = [...state.tabs, tab];
                updateTabs(tabs);
                return {
                    tabs,
                    active: tab.id
                };
            });
        },
        closeTab: (id: string): void => {
            set((state) => {
                const newState: TabsState = {
                    tabs: state.tabs.filter(t => t.id !== id),
                    active: state.active
                };
                if (state.active === id) {
                    const formerIdx = state.tabs.findIndex(t => t.id === id);
                    newState.active = newState.tabs.length > 0 ? newState.tabs[Math.min(formerIdx, newState.tabs.length - 1)].id : null;
                    if (newState.active) {
                        const tab = newState.tabs.find(t => t.id === newState.active);
                        if (tab && tab.path) {
                            repoStore.getState().openRepo(tab.path);
                            stagingArea.getState().reset();
                        }
                    }
                }
                updateTabs(newState.tabs);
                return newState;
            });
        },
        switchTab: (tab: TabState): void => {
            set((state) => {
                Logger().silly('switchTab', 'Switching active tab', { tab: tab });
                state.active = tab.id;
                if (tab.path) {
                    Logger().debug('switchTabs', 'Re-loading repository', {
                        path: tab.path,
                    });
                    repoStore.getState().openRepo(tab.path);
                    stagingArea.getState().reset();
                }
                state.tabs.forEach((t) => t.path && updateHistory(t.path));
                return state;
            });
        },
        openRepoInActive: async (path: string): Promise<void> => {
            const title = await basename(path);
            const state = get();
            Logger().debug('openRepoInActive', 'Opening repository in current tab', { path, active: state.active });
            if (!state.active) {
                Logger().error('openRepoInActive', 'No active tab');
                return;
            }
            const newState = await openInActiveTab(state.tabs, state.active, path, title);
            Logger().debug("openRepoInActive", "Opening tab", newState);
            set((state) => {
                state.tabs = castDraft(newState.tabs);
                state.active = newState.active;
            });
        },
        openRepoInNew: async (path: string): Promise<void> => {
            const title = await basename(path);
            const id = `tab-${nanoid()}`;
            const state = get();
            const tabs = [...state.tabs, {
                id,
                path: null,
                title: '(New Tab)',
            }];
            const newState = await openInActiveTab(tabs, id, path, title);
            set((state) => {
                state.tabs = castDraft(newState.tabs);
                state.active = newState.active;
            });
        },
        loadTabs: (tabs: readonly TabState[]): void => {
            set((state) => {
                Logger().debug('loadTabs', 'Loading stored tabs', { tabs: tabs });
                state.tabs = castDraft(tabs);
            });
            const active = get().active;
            if (active) {
                const activeTab = get().tabs.find(t => t.id === active);
                if (activeTab && activeTab.path) {
                    repoStore.getState().openRepo(activeTab.path);
                }
            }
        },
    }))
);

async function openInActiveTab(tabs: readonly TabState[], active: string, path: string, title: string): Promise<TabsState> {
    const clonedTabs = [...tabs];
    const activeIdx = clonedTabs.findIndex(t => t.id === active);
    Logger().silly('openInActiveTab', 'Opening repository in active tab', {
        path,
        active: activeIdx,
    })
    if (activeIdx === -1) {
        Logger().error('openInActiveTab', 'Could not find active tab to open path in');
        throw new Error("Could not open tab");
    } else {
        try {
            const clonedTab = { ...tabs[activeIdx] };
            clonedTab.path = path;
            clonedTab.title = title;
            Logger().debug('openInActiveTab', 'Re-loading repository', {
                path,
            });
            repoStore.getState().openRepo(path);
            await updateTabs(tabs);
            await updateHistory(path);
            clonedTabs.splice(activeIdx, 1, clonedTab);
            return {
                tabs: clonedTabs,
                active,
            }
        }
        catch (e) {
            console.log(e);
            Logger().error('openInActiveTab', 'Could not open tab', { error: e });
            throw e;
        }
    }
}

/**
 * Get the tab containing the given path, if any
 */
export function getTab(path: string): TabState | null {
    const tabs = tabsStore.getState();
    return tabs.tabs.find(t => t.path === path) ?? null;
}
//
// export function useTabs() {
//     const settings = useSettings();
//     return {
//         tabs: settings.openTabs,
//         active: nothing,
//
//         addTab: async (): Promise<void> => {
//             Logger().debug('addTab', 'Opening new tab');
//             const tab: TabState = {
//                 id: `tab-${nanoid()}`,
//                 path: nothing,
//                 title: '(New Tab)',
//             };
//
//             await updateSettings({
//                 ...settings,
//                 openTabs: [...settings.openTabs, tab],
//                 active: tab.id
//             });
//         },
//     }
// }
export const useTabs = createHook(tabsStore);
