import { TreeNode } from './Tree';
import { splice } from '../../../../util/ImmutableArrayUtils';

/**
 * Insert the given node at the given path in the tree
 *
 * @param tree the existing tree
 * @param segments The path segments of the newly inserted node
 * @param meta The meta data object to attach to the leaf node of the path
 * @param metaCB Callback to provide meta data objects for intermediate nodes, if any
 */
export function insertPath<T>(
    tree: readonly TreeNode<T>[],
    segments: readonly string[],
    meta?: T,
    metaCB?: (path: readonly string[], remaining: readonly string[]) => T,
    path?: string[],
    initialExpanded?: boolean
): readonly TreeNode<T>[] {
    const p = path ?? [];

    if (segments.length === 0) {
        return tree; // definitively stop the recursion, even if there is an attempt to insert a path twice
    }
    const parentIndex = tree.findIndex((b) => b.label === segments[0]);
    if (parentIndex === -1) {
        const newTree = [
            ...tree,
            {
                label: segments[0],
                children: insertPath(
                    [],
                    segments.slice(1),
                    meta,
                    metaCB,
                    p.concat(segments[0]),
                    initialExpanded
                ),
                meta: segments.length === 1 ? meta : metaCB?.(p.concat(segments[0]), segments),
                initialExpanded: initialExpanded,
            },
        ];
        return newTree;
    }
    tree = splice(tree, parentIndex, 1, {
        ...tree[parentIndex],
        children: insertPath(
            tree[parentIndex].children ?? [],
            segments.slice(1),
            meta,
            metaCB,
            p.concat(segments[0]),
            initialExpanded
        ),
        initialExpanded: initialExpanded || tree[parentIndex].initialExpanded,
    });
    return tree;
}
