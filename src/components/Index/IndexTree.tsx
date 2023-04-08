import React from 'react';
import { IndexStatus } from '../../model/stateObjects';
import { Tree, TreeNode } from '../util/Tree/Tree';
import { FileStatus } from '../shared/FileStatus';
import { insertPath } from '../util/Tree/utils';
import { Logger } from '../../util/logger';
import { discardChanges } from '../../model/actions/repo';
import { useDialog, DialogActions } from '../../model/state/dialogs';
import { HoverableSpan } from '../StyleBase';
import { ControlledMenu, ControlledMenuProps, MenuItem, useMenuState } from '@szhsin/react-menu';

const ContextMenu: React.FC<{ treeNode: IndexTreeNode, dialog: DialogActions } & ControlledMenuProps> = (props) => (
    // TODO
    <ControlledMenu {...props} portal>
        <MenuItem onClick={() => {
            Logger().debug('IndexTree', 'Requesting to reset path', { node: props.treeNode });
            discardChanges(props.treeNode);
        }}>Discard changes to {props.treeNode.path}</MenuItem>
        <MenuItem onClick={() => {
            Logger().debug('IndexTree', 'Requesting new ignore list entry', { node: props.treeNode });
            props.dialog.open({ type: 'add-ignore-list-item', path: props.treeNode.path });
        }}>Add {props.treeNode.path} to .gitignore</MenuItem>
    </ControlledMenu>
);

export interface IndexTreeNode extends IndexStatus {
    /**
     * type information distinguishing between directory and file nodes to
     * handle them differently in the click event handlers
     */
    type: 'file' | 'dir';
}

export interface IndexTreeProps {
    files: readonly IndexStatus[];
    isIndex: boolean;
    onEntryDoubleClick?: (file: IndexTreeNode) => void;
    onEntryClick?: (path: IndexTreeNode) => void;
}

const IndexTreeNodeDisplay: React.FC<{ file: string, path: string[], meta?: IndexTreeNode, inIndex: boolean }> = (props) => {
    const [menuProps, toggleMenu] = useMenuState();
    const [anchorPoint, setAnchorPoint] = React.useState({ x: 0, y: 0 });
    const dialog = useDialog();
    return (
        <>
            {props.meta && <ContextMenu treeNode={props.meta} dialog={dialog} {...menuProps} anchorPoint={anchorPoint} onClose={() => toggleMenu(false)} />}
            <HoverableSpan
                title={`${props.path?.join('/') ?? ''}/${props.file}`}
                style={{
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setAnchorPoint({ x: e.clientX, y: e.clientY });
                    toggleMenu(true);
                }}>
                {props.meta && props.meta.type !== 'dir' && (
                    <FileStatus
                        isConflicted={props.meta.isConflicted}
                        status={
                            props.inIndex ? props.meta.indexStatus : props.meta.workdirStatus
                        }
                        style={{ fontSize: '80%', marginRight: '0.25rem' }}
                    />
                )}
                {props.file}
            </HoverableSpan>
        </>
    );

}

export const IndexTree: React.FC<IndexTreeProps> = (props) => {
    const tree = props.files.reduce((existingTree, newFile) => {
        const segments = newFile.path.split('/');
        return insertPath<IndexTreeNode>(
            existingTree,
            segments,
            { ...newFile, type: 'file' },
            (path, _) => {
                Logger().debug('IndexTree', 'Requesting internal meta data node', { path: path });
                return {
                    type: 'dir',
                    path: path.join('/'),
                    isStaged: props.isIndex,
                    isConflicted: false,
                    workdirStatus: 'unknown',
                    indexStatus: 'unknown',
                };
            }
        );
    }, [] as readonly TreeNode<IndexTreeNode>[]);
    return (
        <>
            {tree.map((root) => (
                <Tree
                    key={root.label}
                    root={root}
                    expanded
                    label={(file, path, _, meta) => <IndexTreeNodeDisplay file={file} meta={meta} path={path} inIndex={props.isIndex} />}
                    onEntryDoubleClick={(meta) =>
                        meta && props.onEntryDoubleClick && props.onEntryDoubleClick(meta)
                    }
                    onEntryClick={(meta) => meta && props.onEntryClick && props.onEntryClick(meta)}
                />
            ))}
        </>
    );
};
