import React from 'react';
import { IndexStatus } from '../../../model/stateObjects';
import { Tree, TreeNode } from '../util/Tree/Tree';
import { FileStatus } from '../shared/FileStatus';
import { insertPath } from '../util/Tree/utils';
import { Logger } from '../../../util/logger';
import { remote } from 'electron';
import { discardChanges } from '../../../model/actions/repo';
import { useDialog, DialogActions } from '../../../model/state/dialogs';

const { Menu, MenuItem } = remote;

function openContextMenu(treeNode: IndexTreeNode, dialog: DialogActions) {
    const menu = Menu.buildFromTemplate([
        {
            label: `Discard changes to ${treeNode.path}`,
            click: () => {
                Logger().debug('IndexTree', 'Requesting to reset path', { node: treeNode });
                discardChanges(treeNode);
            },
        },
        {
            label: `Add ${treeNode.path} to .gitignore`,
            click: () => {
                Logger().debug('IndexTree', 'Requesting new ignore list entry', { node: treeNode });
                dialog.open({ type: 'add-ignore-list-item', path: treeNode.path });
            },
        },
    ]);
    Logger().silly('IndexTree', 'Open context menu', { node: treeNode });
    menu.popup({ window: remote.getCurrentWindow() });
}

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
    const dialog = useDialog();
    return (
        <>
            {tree.map((root) => (
                <Tree
                    key={root.label}
                    root={root}
                    expanded
                    label={(file, path, _, meta) => {
                        return (
                            <span
                                title={`${path?.join('/') ?? ''}/${file}`}
                                onContextMenu={() => meta && openContextMenu(meta, dialog)}>
                                {meta && meta.type !== 'dir' && (
                                    <FileStatus
                                        isConflicted={meta.isConflicted}
                                        status={
                                            props.isIndex ? meta.indexStatus : meta.workdirStatus
                                        }
                                        style={{ fontSize: '80%', marginRight: '0.25rem' }}
                                    />
                                )}
                                {file}
                            </span>
                        );
                    }}
                    onEntryDoubleClick={(meta) =>
                        meta && props.onEntryDoubleClick && props.onEntryDoubleClick(meta)
                    }
                    onEntryClick={(meta) => meta && props.onEntryClick && props.onEntryClick(meta)}
                />
            ))}
        </>
    );
};
