import { TabsState } from './tabs';

export function allActivePaths(tabs: TabsState): string[] {
    return tabs.tabs.flatMap(t => t.path.found ? t.path.value : []);
}
