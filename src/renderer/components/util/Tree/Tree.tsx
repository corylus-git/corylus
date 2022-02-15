import * as React from 'react';
import styled from 'styled-components';
import { ArrowDown } from '../../icons/ArrowDown';
import { ArrowRight } from '../../icons/ArrowRight';
import { Logger } from '../../../../util/logger';
import { HoverableSpan } from '../../StyleBase';

export interface TreeNode<T> {
    readonly key?: string;
    readonly label: string;
    readonly meta?: T;
    readonly children: readonly TreeNode<T>[];
    readonly initialExpanded?: boolean;
}

/**
 * Properties of the Tree component
 */
export interface TreeProps<T> {
    /**
     * The base path of the given tree. This is used in sub-trees to make
     * the attachment point of the tree to its parent known.
     */
    basePath?: string[];
    /**
     * The root-node of the tree
     */
    root: TreeNode<T>;
    /**
     * The render function for individual nodes
     */
    node?: (node: TreeNode<T>) => JSX.Element;
    /**
     * The render function for the node label
     *
     * @param label The current label of the tree node according to the tree
     * @param path The path to the current node
     * @param open Indicates whether the node is currently open, i.e. its children are visible
     * @param meta Any meta information associated with said node. Only set on leaf nodes
     */
    label?: (label: string, path: string[], open: boolean, meta?: T) => JSX.Element;
    /**
     * Callback firing when a node is double-clicked
     */
    onEntryDoubleClick?: (meta?: T) => void;
    /**
     * Callback firing when an entry is single-clicked
     */
    onEntryClick?: (meta?: T) => void;
    /**
     * If true, the nodes of the tree are expanded by default, collapsed otherwise.
     */
    expanded?: boolean;
}

const SubTree = styled.div`
    position: relative;
    margin-left: 1rem;
`;

const Child = styled.span`
    display: inline-block;
    box-sizing: border-box;
    margin-left: -1rem;
    height: 1rem;
    position: absolute;
`;

export function Tree<T>(props: TreeProps<T>): JSX.Element {
    const [open, setOpen] = React.useState(!!props.expanded || !!props.root.initialExpanded);
    React.useEffect(() => setOpen(!!props.expanded || !!props.root.initialExpanded), [
        props.expanded,
        props.root.initialExpanded,
    ]);
    return (
        <SubTree
            onDoubleClick={(ev) => {
                Logger().silly('Tree', 'Double-clicking tree node', { nodeData: props.root });
                props.onEntryDoubleClick && props.onEntryDoubleClick(props.root.meta);
                ev.stopPropagation();
            }}
            onClick={(ev) => {
                Logger().silly('Tree', 'Single-clicking tree node', { nodeData: props.root });
                props.onEntryClick && props.onEntryClick(props.root.meta);
                ev.stopPropagation();
            }}>
            <div>
                {props.root.children.length !== 0 && (
                    <Child onClick={() => setOpen(!open)}>
                        {open ? <ArrowDown /> : <ArrowRight />}
                    </Child>
                )}
                {props.label ? (
                    props.label(props.root.label, props.basePath ?? [], open, props.root.meta)
                ) : (
                    <HoverableSpan>{props.root.label}</HoverableSpan>
                )}
            </div>
            {open && (
                <div>
                    {props.root.children.map((child) => (
                        <Tree
                            key={child.key ?? child.label}
                            root={child}
                            basePath={(props.basePath ?? []).concat([props.root.label])}
                            label={props.label}
                            node={props.node}
                            onEntryDoubleClick={props.onEntryDoubleClick}
                            onEntryClick={props.onEntryClick}
                            expanded={props.expanded}
                        />
                    ))}
                </div>
            )}
        </SubTree>
    );
}
