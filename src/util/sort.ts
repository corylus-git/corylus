import { Commit } from '../model/stateObjects';

interface IndexedNode {
    index: number;
    entry: Commit;
}

/**
 * Explore the history starting from a specific node in a depth-first manner
 *
 * @param root The node from which to explore the graph
 * @param history The full history containing all nodes
 * @returns the next free index
 */
function exploreNode(root: IndexedNode, history: IndexedNode[], nextIndex: number): number {
    if (root.index === -1) {
        // this node and its predecessors haven't been explored yet
        root.index = 0; // we kind of misuse the index as an exploration marker -> mark this node temporarily as explored
        const parents = history.filter(
            (entry) => !!root.entry.parents.find((p) => p.oid === entry.entry.oid)
        );
        let ni = nextIndex;
        for (const parent of parents) {
            ni = exploreNode(parent, history, ni);
        }
        root.index = ni;
        return ni + 1;
    }
    return nextIndex;
}

/**
 * Sort the git history graph topologically. Inspired by the algorithm presented
 * at https://pvigier.github.io/2019/05/06/commit-graph-drawing-algorithms.html
 *
 * @param history The git history to sort
 */
export function topologicalSort(history: Commit[]): Commit[] {
    const topoNodes: IndexedNode[] = history.map((entry) => ({ index: -1, entry }));
    // topoNodes.sort((e1, e2) =>
    //     e2.entry.type === 'commit' && e1.entry.type === 'commit'
    //         ? e2.entry.committer.timestamp.getTime() - e1.entry.committer.timestamp.getTime()
    //         : e2.entry.author.timestamp.getTime() - e1.entry.author.timestamp.getTime()
    // );
    let nextIndex = 0;
    for (const node of topoNodes) {
        nextIndex = exploreNode(node, topoNodes, nextIndex);
    }
    topoNodes.sort((n1, n2) => n2.index - n1.index);
    return topoNodes.map((n) => n.entry);
}
