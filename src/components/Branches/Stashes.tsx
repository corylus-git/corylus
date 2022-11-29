import React from 'react';
import { Stash } from '../../model/stateObjects';
import { HoverableDiv } from '../StyleBase';
import styled from 'styled-components';
import { Tree, TreeNode } from '../util/Tree/Tree';
import { TypeHeader } from './TypeHeader';
import { DialogActions, useDialog } from '../../model/state/dialogs';
import { useStashes, repoStore } from '../../model/state/repo';
import { invoke } from '@tauri-apps/api';

const StashDisplay = styled(HoverableDiv)`
    border-bottom: 1px dotted var(--border);
    padding-left: 0.5rem;
`;

const RefDisplay = styled.span`
    font-weight: bold;
    margin-left: -0.5rem;
`;

function openContextMenu(dialog: DialogActions, stash: Stash) {
    // TODO
    // const menu = new Menu();
    // menu.append(
    //     new MenuItem({
    //         label: `Apply ${stash.ref} to working copy`,
    //         click: () => dialog.open({ type: 'request-stash-apply', stash: stash }),
    //     })
    // );
    // menu.append(
    //     new MenuItem({
    //         label: `Delete ${stash.ref}`,
    //         click: () =>
    //             dialog.open({
    //                 type: 'request-stash-drop',
    //                 stash: stash,
    //             }),
    //     })
    // );
    // menu.popup({ window: getCurrentWindow() });
}

export const Stashes: React.FC = () => {
    const { isLoading, error, data: stashes } = useStashes();
    const dialog = useDialog();
    if (isLoading) {
        return <>Loading stashes...</>
    }
    if (error) {
        return <>Could not load stashes</>
    }
    if (stashes) {
        return (
            <Tree
                label={(l, p, o, m) =>
                    p.length === 0 ? (
                        <TypeHeader>{`${l}${o ? '' : ` (${stashes.length ?? 0})`}`}</TypeHeader>
                    ) : (
                        <StashDisplay
                            onClick={() => invoke('get_commit_stats', { oid: m!.oid, isStash: true })}
                            onContextMenu={() => openContextMenu(dialog, m!)}>
                            <RefDisplay>{m!.refName}</RefDisplay> {m!.message}
                        </StashDisplay>
                    )
                }
                root={{
                    label: 'Stashes',
                    children: stashes.map<TreeNode<Stash>>((entry) => ({
                        key: entry.oid,
                        label: entry.message,
                        children: [],
                        meta: entry,
                    })),
                }}
            />
        );
    }
    return <>Internal error...</>
};
