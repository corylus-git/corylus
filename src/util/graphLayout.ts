import { Commit } from '../model/stateObjects';
import { Logger } from './logger';
import { Rail } from '../renderer/components/History/RailLine';
import { splice } from './ImmutableArrayUtils';

export interface LayoutListEntry {
    rail: number;
    hasParent: boolean;
    hasChild: boolean;
    outgoing: number | undefined;
    incoming: number[];
    rails: readonly Rail[];
    commit: Commit;
}

export type GraphLayoutData = {
    lines: readonly LayoutListEntry[];
    rails: readonly Rail[];
};

/**
 * Find the first free rail and insert the given entry to
 *
 * @param rails The rails as exist so far
 * @param newEntry The new entry to set on a rail
 */
function useFirstFreeRail(
    rails: readonly Rail[],
    newEntry: Rail
): {
    rails: readonly Rail[];
    insertionPoint: number;
} {
    const freeIndex = rails.findIndex((r) => r === undefined);
    if (freeIndex === -1) {
        return { rails: [...rails, newEntry], insertionPoint: rails.length };
    }
    const s = splice(rails, freeIndex, 1, newEntry);
    return {
        rails: s,
        insertionPoint: freeIndex,
    };
}

export function calculateSubLayout(
    existingRails: readonly Rail[],
    historyEntries: readonly Commit[]
): GraphLayoutData {
    let rails: readonly Rail[] = [...existingRails];
    const lines = historyEntries.map((entry) => {
        Logger().silly('Graph', 'Mapping entry', { entry: entry });
        let outgoing: number | undefined = undefined;
        let leftMostChildRail = rails.findIndex((r) => r === entry.oid);
        let hasChild = true;
        const parents = [...entry.parents];
        if (leftMostChildRail !== -1) {
            const p = parents.shift();
            rails = splice(rails, leftMostChildRail, 1, p?.oid);
        } else {
            hasChild = false;
            const result = useFirstFreeRail(rails, parents.shift()?.oid);
            leftMostChildRail = result.insertionPoint;
            rails = result.rails;
        }
        const incoming = rails.reduce(
            (occurences, r, index) => (r === entry.oid ? [...occurences, index] : occurences),
            [] as number[]
        );
        rails = rails.map((r) => (r === entry.oid ? undefined : r)); // free up all rails expecting the same parent
        parents.forEach((p) => {
            const parentIndex = rails.findIndex((r) => r === p.oid);
            if (parentIndex === -1) {
                const result = useFirstFreeRail(rails, p.oid);
                rails = result.rails;
                outgoing = result.insertionPoint; // we can reassign the variable, as there are two parents at most anyway and we only need the last
            } else {
                // our parent already exists -> we are a merge from an existing rail
                incoming.push(parentIndex);
            }
        });
        const mappedValue = {
            commit: entry,
            rail: leftMostChildRail,
            hasParent: entry.parents.length > 0,
            hasChild: hasChild,
            outgoing: outgoing,
            incoming: incoming,
            rails: rails,
        };
        Logger().silly('Graph', 'Done calculating node.');
        return mappedValue;
    });
    Logger().silly('Graph', 'Done recalculating history graph');

    return {
        lines: lines,
        rails: rails,
    };
}

export function calculateGraphLayout(orderedHistory: readonly Commit[]): GraphLayoutData {
    Logger().silly('Graph', 'History changed. Recalculating graph');
    let graphData: GraphLayoutData = { lines: [], rails: [] };
    for (let index = 0; index < orderedHistory.length; index += 100) {
        const increment = calculateSubLayout(
            graphData.rails,
            orderedHistory.slice(index, index + 100)
        );
        graphData = {
            lines: [...graphData.lines, ...increment.lines],
            rails: increment.rails,
        };
    }
    return graphData;
}
