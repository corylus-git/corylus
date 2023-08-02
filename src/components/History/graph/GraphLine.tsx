import { ControlledMenu, ControlledMenuProps, MenuItem, useMenuState } from '@szhsin/react-menu';
import React from 'react';
import { useQuery } from 'react-query';
import { BranchInfo } from '../../../model/stateObjects';
import { SelectableListEntryProps } from '../../util/SelectableList';
import { CommitInfo } from '../CommitInfo';
import { GraphNode } from './GraphNode';
import { RailLine } from './RailLine';
import { GraphLineProps, CommitEntry, CommitMessage } from './GraphRenderer';
import { useDialog } from '../../../model/state/dialogs';
import { just, nothing } from '../../../util/maybe';
import { changeBranch } from '../../../model/actions/repo';
import { getGraphEntries } from '../../../model/state/graph';

const ContextMenu: React.FC<{
    refName: string,
    shortRef: string,
    currentBranch: BranchInfo | undefined
} & ControlledMenuProps> = (props) => {
    const dialog = useDialog();
    return <ControlledMenu {...props} portal>
        <MenuItem onClick={() => dialog.open({
            type: 'request-new-branch',
            subType: 'commit',
            source: just(props.refName),
            branchPrefix: nothing,
        })}>Create branch from {props.shortRef}</MenuItem>
        <MenuItem onClick={() => dialog.open({ type: 'request-merge', source: just(props.refName) })}>Merge {props.shortRef} into {props.currentBranch?.refName}</MenuItem>
        <MenuItem onClick={() => dialog.open({ type: 'request-create-tag', ref: props.refName })}>Create tag at {props.shortRef}</MenuItem>
        <MenuItem onClick={() => dialog.open({ type: 'rebase', target: props.refName })}>Rebase current branch here</MenuItem>
        <MenuItem onClick={() => dialog.open({ type: 'interactive-rebase', target: props.refName })}>Interactively rebase current branch here</MenuItem>
        {props.currentBranch?.head !== props.refName &&
            <MenuItem onClick={() => changeBranch(props.refName)}>Checkout {props.shortRef} as detached HEAD</MenuItem>}
        {props.currentBranch &&
            <MenuItem onClick={() => {
                props.currentBranch && dialog.open({
                    type: 'request-branch-reset',
                    branch: props.currentBranch?.refName,
                    toRef: props.refName,
                })
            }}>Reset {props.currentBranch.refName} to {props.shortRef}</MenuItem>}
    </ControlledMenu>
}

function useGraphLine(idx: number) {
    console.log("Using graph line", idx);
    // console.log("Current cache state", queryClient.getQueryData(['graphLine', idx]), queryClient.getQueryCache().find(['graphLine', idx])?.isStale(), queryClient.getQueryCache().find(['graphLine', idx])?.isActive(), queryClient.getQueryCache().find(['graphLine', idx])?.isFetching());
    return useQuery(["graphLine", idx], async () => {
        console.log("Starting query", { index: idx })
        try {
            const data = (await getGraphEntries(idx, idx + 1))[0];
            console.log("Finished", { index: idx });
            return data;
        }
        catch (e) {
            console.error("Query failed", e);
        }
    });
}

export const GraphLine: React.FC<SelectableListEntryProps & GraphLineProps & { currentBranch: BranchInfo | undefined; }> = (props) => {
    // console.log('GraphLine', 'Rendering GraphLine', { index: props.index });
    // TODO this breaks when caching is enabled and I currently don't know why...
    const { isLoading, error, data: e } = useGraphLine(props.index);
    const [menuProps, toggleMenu] = useMenuState();
    const [anchorPoint, setAnchorPoint] = React.useState({ x: 0, y: 0 });
    if (isLoading) {
        return <>...</>;
    }
    if (error || !e) {
        return <>Could not load graph line...</>;
    }
    const max_incoming = e.incoming.reduce((existing, candidate) => Math.max(existing, candidate), 0);
    const max_outgoing = e.outgoing.reduce((existing, candidate) => Math.max(existing, candidate), 0);
    let width = Math.max(e.rails.length - 1, e.rail, max_incoming, max_outgoing);
    width++;
    return (
        <>
            <ContextMenu {...menuProps} anchorPoint={anchorPoint} refName={e.commit.oid} shortRef={e.commit.shortOid} currentBranch={props.currentBranch} onClose={() => toggleMenu(false)} />
            <CommitEntry
                key={e.commit.oid}
                style={props.style}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setAnchorPoint({ x: e.clientX, y: e.clientY });
                    toggleMenu(true);
                }}
                isSelected={props.selected}>
                <RailLine size={width} className="rails">
                    <GraphNode
                        rail={e.rail}
                        hasChildLine={e.hasChildLine}
                        hasParentLine={e.hasParentLine}
                        incoming={e.incoming}
                        outgoing={e.outgoing}
                        rails={e.rails}
                        reverse={props.reverse}
                        width={width} />
                </RailLine>
                <CommitMessage>
                    <CommitInfo
                        commit={e.commit}
                        branches={props.branches}
                        tags={props.tags}
                        rail={e.rail}
                        searchTerm={props.searchTerm} />
                </CommitMessage>
            </CommitEntry>
        </>
    );
};
