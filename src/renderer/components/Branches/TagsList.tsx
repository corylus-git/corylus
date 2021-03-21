import React from 'react';
import { Tree, TreeNode } from '../util/Tree/Tree';
import { TypeHeader } from './TypeHeader';
import { HoverableDiv } from '../StyleBase';
import styled from 'styled-components';
import { remote } from 'electron';
import { Tag } from '../../../model/stateObjects';
import { deleteTag } from '../../../model/actions/repo';
import { useTags, repoStore } from '../../../model/state/repo';

const { Menu } = remote;

const TagDisplay = styled(HoverableDiv)`
    padding: 2px;
`;

function openContextMenu(tag: Tag) {
    const menu = Menu.buildFromTemplate([
        {
            label: `Delete tag ${tag.name}`,
            click: () => {
                const del = confirm(`Really delete tag ${tag.name}?`);
                if (del) {
                    deleteTag(tag);
                }
            },
        },
    ]);
    menu.popup({ window: remote.getCurrentWindow() });
}

export const TagsList: React.FC = () => {
    const tags = useTags();
    return (
        <Tree
            key="Tags"
            root={{
                label: 'Tags',
                children: tags.map<TreeNode<Tag>>((t) => ({
                    label: t.name,
                    children: [],
                    meta: t,
                })),
            }}
            label={(label, path, open, meta) =>
                path.length === 0 ? (
                    <TypeHeader>{`${label}${open ? '' : ` (${tags.length})`}`}</TypeHeader>
                ) : (
                    <TagDisplay onContextMenu={() => openContextMenu(meta!)}>{label}</TagDisplay>
                )
            }
            onEntryClick={(meta) => {
                if (meta) {
                    repoStore.getState().selectCommit(meta.taggedOid);
                }
            }}
        />
    );
};
