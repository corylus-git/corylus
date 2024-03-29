import create from 'zustand/vanilla';
import createHook from 'zustand';
import produce from 'immer';
import { nothing, just, fromNullable, Maybe } from '../../util/maybe';
import { Middleware } from './types';
import { nanoid } from 'nanoid';
import { Logger } from '../../util/logger';
import { log } from './log';
import { basename } from 'path';
import { repoStore } from './repo';
import { appSettings } from '../settings';
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
    path: Maybe<string>;
}

export type TabsState = {
    /**
     * all currently open tabs
     */
    tabs: readonly TabState[];
    /**
     * The id of active tab
     */
    active: Maybe<string>;
};

type TabsActions = {
    addTab: () => void;
    closeTab: (id: string) => void;
    switchTab: (tab: TabState) => void;
    openRepoInActive: (path: string) => void;
    openRepoInNew: (path: string) => void;
    loadTabs: (tabs: readonly TabState[]) => void;
};

// Turn the set method into an immer proxy
const immer: Middleware<TabsState & TabsActions> = (config) => (set, get, api) =>
    config((fn: any) => set(produce(fn)), get, api);

export const tabsStore = create(
    log(
        immer((set, get) => ({
            tabs: [],
            active: nothing,
            addTab: (): void => {
                set((state) => {
                    Logger().debug('addTab', 'Opening new tab');
                    const tab: TabState = {
                        id: `tab-${nanoid()}`,
                        path: nothing,
                        title: '(New Tab)',
                    };
                    return {
                        tabs: [...state.tabs, tab],
                        active: just(tab.id)
                    };
                });
            },
            closeTab: (id: string): void => {
                set((state) => {
                    const newState: TabsState = {
                        tabs: state.tabs.filter(t => t.id !== id),
                        active: state.active
                    };
                    if (state.active.found && state.active.value === id) {
                        const formerIdx = state.tabs.findIndex(t => t.id === id);
                        newState.active = newState.tabs.length > 0 ? just(newState.tabs[Math.min(formerIdx, newState.tabs.length - 1)].id) : nothing;
                        if (newState.active.found) {
                            const tab = newState.tabs.find(t => newState.active.found && t.id === newState.active.value);
                            if (tab && tab.path.found) {
                                repoStore.getState().openRepo(tab.path.value);
                                stagingArea.getState().reset();
                            }
                        }
                    }
                    return newState;
                });
            },
            switchTab: (tab: TabState): void => {
                set((state) => {
                    Logger().silly('switchTab', 'Switching active tab', { tab: tab });
                    state.active = just(tab.id);
                    if (tab.path.found) {
                        Logger().debug('switchTabs', 'Re-loading repository', {
                            path: tab.path.value,
                        });
                        repoStore.getState().openRepo(tab.path.value);
                        stagingArea.getState().reset();
                    }
                    state.tabs.forEach((t) => t.path.found && appSettings().updateHistory(t.path.value));
                    return state;
                });
            },
            openRepoInActive: (path: string): void => {
                set((state) => openInActiveTab(state, path));
            },
            openRepoInNew: (path: string): void => {
                set((state) => {
                    const id = `tab-${nanoid()}`;
                    state.tabs = [...state.tabs, {
                        id,
                        path: nothing,
                        title: '(New Tab)',
                    }];
                    state.active = just(id); 
                    openInActiveTab(state, path);
                });
            },
            loadTabs: (tabs: readonly TabState[]): void => {
                set((state) => {
                    Logger().debug('loadTabs', 'Loading stored tabs', { tabs: tabs });
                    state.tabs = tabs;
                });
                const active = get().active;
                if (active.found) {
                    const activeTab = get().tabs.find(t => t.id === active.value);
                    if (activeTab && activeTab.path.found) {
                        repoStore.getState().openRepo(activeTab.path.value);
                    }
                }
            },
        }))
    )
);

function openInActiveTab(state: TabsState, path: string)
{
    const active = state.tabs.find(t => state.active.found && t.id === state.active.value);
    if (!active) {
        Logger().error('openInActiveTab', 'Could not find active tab to open path in');
    } else {
        active.path = just(path);
        active.title = basename(path);
        Logger().debug('openInActiveTab', 'Re-loading repository', {
            path,
        });
        repoStore.getState().openRepo(path);
        appSettings().updateHistory(path);
    }
}

/**
 * Get the tab containing the given path, if any
 */
export function getTab(path: string): TabState | undefined
{
    const tabs = tabsStore.getState();
    return tabs.tabs.find(t => t.path.found && t.path.value === path)
}


export const useTabs = createHook(tabsStore);
