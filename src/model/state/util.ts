import { TabsState } from './tabs';

export function allActivePaths(tabs: TabsState): string[] {
    return tabs.active.found && tabs.active.value.path.found
        ? [
              ...tabs.left
                  .filter((t) => t.path.found)
                  .map((t) => (t.path.found && t.path.value) || ''),
              tabs.active.value.path.value,
              ...tabs.right
                  .filter((t) => t.path.found)
                  .map((t) => (t.path.found && t.path.value) || ''),
          ]
        : [
              ...tabs.left
                  .filter((t) => t.path.found)
                  .map((t) => (t.path.found && t.path.value) || ''),
              ...tabs.right
                  .filter((t) => t.path.found)
                  .map((t) => (t.path.found && t.path.value) || ''),
          ];
}
