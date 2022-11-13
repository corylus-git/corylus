import create from 'zustand/vanilla';
import createHook from 'zustand';
import produce from 'immer';
import { nothing, just, fromNullable, Maybe } from '../../util/maybe';
import { Middleware } from './types';
import { nanoid } from 'nanoid';
import { Logger } from '../../util/logger';
import { log } from './log';
import { basename } from '@tauri-apps/api/path';
import { appWindow } from '@tauri-apps/api/window';
import { repoStore } from './repo';
import { appSettings } from '../settings';
import { stagingArea } from './stagingArea';
import { getActiveElement } from 'formik';

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
     * Open tabs to the left of the active tab
     */
    left: readonly TabState[];
    /**
     * The currently active tab
     */
    active: Maybe<TabState>;
    /**
     * Tabs to the right of the currently active tab
     */
    right: readonly TabState[];
};

export type TabsActions = {
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
            left: [],
            active: nothing,
            right: [],
            addTab: (): void => {
                set((state) => {
                    Logger().debug('addTab', 'Opening new tab');
                    const tab: TabState = {
                        id: `tab-${nanoid()}`,
                        path: nothing,
                        title: '(New Tab)',
                    };
                    return {
                        left: state.active.found
                            ? [...state.left, state.active.value, ...state.right]
                            : [...state.left, ...state.right],
                        active: just(tab),
                        right: [],
                    };
                });
            },
            closeTab: (id: string): void => {
                set((state) => {
                    const intermediate: TabsState = {
                        left: state.left.filter((t) => t.id !== id),
                        active:
                            !state.active.found || id !== state.active.value.id
                                ? state.active
                                : nothing,
                        right: state.right.filter((t) => t.id !== id),
                    };
                    if (intermediate.active.found) {
                        Logger().debug('closeTab', 'Closed non-active tab', {
                            tabs: intermediate,
                        });
                        return intermediate;
                    }
                    const ret = {
                        left:
                            intermediate.left.length > 0
                                ? intermediate.left.slice(0, intermediate.left.length)
                                : intermediate.left,
                        active: fromNullable(
                            intermediate.left[intermediate.left.length] ?? intermediate.right[0]
                        ),
                        right:
                            intermediate.left.length > 0
                                ? intermediate.right
                                : intermediate.right.slice(1),
                    };
                    Logger().debug('closeTab', 'Closed active tab', { tabs: ret });
                    return ret;
                });
            },
            switchTab: (tab: TabState): void => {
                set((state) => {
                    Logger().silly('switchTab', 'Switching active tab', { tab: tab });
                    const all = state.active.found
                        ? [...state.left, state.active.value, ...state.right]
                        : [...state.left, ...state.right];
                    const index = all.findIndex((t) => t.id === tab.id);
                    if (tab.path.found) {
                        Logger().debug('switchTabs', 'Re-loading repository', {
                            path: tab.path.value,
                        });
                        repoStore.getState().openRepo(tab.path.value);
                        stagingArea.getState().reset();
                    }
                    all.forEach((t) => t.path.found && appSettings().updateHistory(t.path.value));
                    return {
                        left: all.slice(0, index),
                        active: just(tab),
                        right: all.slice(index + 1),
                    };
                });
            },
            openRepoInActive: async (path: string): Promise<void> => {
                const tab = await openInActiveTab(path);
                set((state) => {
                    state.active = tab;
                    return state;
                });
            },
            openRepoInNew: (path: string): void => {
                set((state) => {
                    if (state.active.found) {
                        state.left = [...state.left, state.active.value];
                    }
                    openInActiveTab(state, path);
                });
            },
            loadTabs: (tabs: readonly TabState[]): void => {
                set((state) => {
                    Logger().debug('loadTabs', 'Loading stored tabs', { tabs: tabs });
                    state.left = [];
                    state.active = fromNullable(tabs[0]);
                    state.right = tabs.slice(1);
                });
                const active = get().active;
                if (active.found && active.value.path.found) {
                    repoStore.getState().openRepo(active.value.path.value);
                }
            },
        }))
    )
);

appWindow.listen('branchesChanged', ev => {
    console.log("Branches changed", ev.payload);
});

appWindow.listen('historyChanged', ev => {
    console.log("History changed", ev.payload);
});


async function openInActiveTab(path: string): Promise<Maybe<TabState>>
{
    Logger().debug('openInActiveTab', 'Re-loading repository', {
        path,
    });

    repoStore.getState().openRepo(path);
    (await appSettings()).updateHistory(path);
    return just({
        id: nanoid(),
        path: just(path),
        title: await basename(path),
    });
}

/**
 * Get the tab containing the given path, if any
 */
export function getTab(path: string): TabState | undefined
{
    const tabs = tabsStore.getState();
    let tab = tabs.left.find(t => t.path.found && t.path.value === path);
    if (tab) {
        return tab;
    }
    tab = tabs.right.find(t => t.path.found && t.path.value === path);
    if (tab) {
        return tab;
    }
    if (tabs.active.found && tabs.active.value.path.found &&  tabs.active.value.path.value === path) {
        return tabs.active.value;
    }
    return undefined;
}


export const useTabs = createHook(tabsStore);
