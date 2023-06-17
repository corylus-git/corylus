import React from 'react';
import { Stash, StashData } from '../../model/stateObjects';
import { HoverableDiv } from '../StyleBase';
import styled from 'styled-components';
import { Tree, TreeNode } from '../util/Tree/Tree';
import { TypeHeader } from './TypeHeader';
import { DialogActions, useDialog } from '../../model/state/dialogs';
import { useStashes } from '../../model/state/repo';
import { invoke } from '@tauri-apps/api';
import { ControlledMenu, ControlledMenuProps, MenuItem, useMenuState } from '@szhsin/react-menu';

const StashDisplay = styled(HoverableDiv)`
    border-bottom: 1px dotted var(--border);
    padding-left: 0.5rem;
`;

const RefDisplay = styled.span`
    font-weight: bold;
    margin-left: -0.5rem;
`;

const ContextMenu: React.FC<{ stash: StashData, dialog: DialogActions } & ControlledMenuProps> = (props) => (
    <ControlledMenu {...props} portal>
        <MenuItem onClick={() => props.dialog.open({
            type
                : 'request-stash-apply', stash: props.stash
        })}>Apply {props.stash.refName} to working copy</MenuItem>
        <MenuItem onClick={() =>
            props.dialog.open({
                type: 'request-stash-drop',
                stash: props.stash,
            })}>Delete {props.stash.refName}</MenuItem>
    </ControlledMenu>
);

const StashEntry: React.FC<{ stash: StashData, dialog: DialogActions }> = (props) => {
    const [menuProps, toggleMenu] = useMenuState();
    const [anchorPoint, setAnchorPoint] = React.useState({ x: 0, y: 0 });
    return <>
        <ContextMenu stash={props.stash} dialog={props.dialog} {...menuProps} onClose={() => toggleMenu(false)} anchorPoint={anchorPoint} />
        <StashDisplay
            onClick={() => invoke('get_stash_stats', { oid: props.stash.oid })}
            onContextMenu={(e) => {
                e.preventDefault();
                setAnchorPoint({ x: e.clientX, y: e.clientY });
                toggleMenu(true);
            }}>
            <RefDisplay>{props.stash.refName}</RefDisplay> {props.stash.message}
        </StashDisplay>
    </>
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
                        <StashEntry stash={m!} dialog={dialog} />
                    )
                }
                root={{
                    label: 'Stashes',
                    children: stashes.map<TreeNode<StashData>>((entry) => ({
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
