import { ControlledMenu, ControlledMenuProps, MenuItem, useMenuState } from '@szhsin/react-menu';
import React from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { changeBranch } from '../../model/actions/repo';
import { useDialog } from '../../model/state/dialogs';
import { useCurrentBranch } from '../../model/state/repo';
import { BranchInfo, Commit, Tag } from '../../model/stateObjects';
import { LayoutListEntry } from '../../util/graphLayout';
import { just, nothing } from '../../util/maybe';
import { HoverableDiv } from '../StyleBase';
import { ListSelector, SelectableList, SelectableListEntryProps } from '../util/SelectableList';
import { CommitInfo } from './CommitInfo';
import { GraphNode } from './GraphNode';
import { RailLine } from './RailLine';

const CommitMessage = styled.div`
    flex-grow: 1;
`;

const CommitEntry = styled(HoverableDiv) <{ isSelected?: boolean }>`
    display: flex;
    background-color: ${(props) => (props.isSelected ? 'var(--selected)' : undefined)};
`;

const ZoomSizeDetector = styled.div`
	position: absolute;
	z-index: -100;
	width: 1rem;
	height: 1rem;
	margin: 0;
	border: 0;
	top: 0;
	left: 0;
	display: hidden;
`;

export interface SizableControlProps {
    width: number;
    height: number;
}

export type GraphRendererProps = {
    getLine: (idx: number) => Promise<LayoutListEntry>;
    totalCommits: number;
    first: number;
    branches: readonly BranchInfo[];
    tags: readonly Tag[];
    searchTerm?: string;
    multi?: boolean;
    onOpenContextMenu?: (commit: Commit) => void;
    onCommitsSelected?: (commits: readonly Commit[]) => void;
} & SizableControlProps;

export type GraphLineProps = {
    getLine: (idx: number) => Promise<LayoutListEntry>;
    selected: boolean;
    onOpenContextMenu?: (commit: Commit) => void;
    branches: readonly BranchInfo[];
    tags: readonly Tag[];
    searchTerm?: string;
    reverse?: boolean;
};

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

export const GraphLine: React.FC<SelectableListEntryProps & GraphLineProps & { currentBranch: BranchInfo | undefined }> = (props) => {
    const { isLoading, error, data: e } = useQuery(["graphLine", props.index], () => props.getLine(props.index));
    const [menuProps, toggleMenu] = useMenuState();
    const [anchorPoint, setAnchorPoint] = React.useState({ x: 0, y: 0 });
    if (isLoading) {
        return <>...</>;
    }
    if (error || !e) {
        return <>Could not load graph line...</>
    }
    let width = e.rails.length - 1;
    while (e.rails[width] === undefined && width > 0) {
        width--;
    }
    if (e.incoming.length > 0) {
        width = Math.max(e.incoming[e.incoming.length - 1], width);
    }
    width++;
    return (
        <>
            <ContextMenu {...menuProps} anchorPoint={anchorPoint} refName={e.commit.oid} shortRef={e.commit.shortOid} currentBranch={undefined} onClose={() => toggleMenu(false)} />
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
                        hasChild={e.hasChild}
                        hasParent={e.hasParent}
                        incoming={e.incoming}
                        outgoing={e.outgoing}
                        rails={e.rails}
                        reverse={props.reverse}
                    />
                </RailLine>
                <CommitMessage>
                    <CommitInfo
                        commit={e.commit}
                        branches={props.branches}
                        tags={props.tags}
                        rail={e.rail}
                        searchTerm={props.searchTerm}
                    />
                </CommitMessage>
            </CommitEntry>
        </>
    );
};

export const GraphRenderer = React.forwardRef<ListSelector, GraphRendererProps>((props, ref) => {
    const { getLine, branches, tags, searchTerm, onOpenContextMenu } = props;
    const zoomDetectorRef = React.useRef<HTMLDivElement>(null);
    const [baseHeight, setBaseHeight] = React.useState(16);
    const currentBranch = useCurrentBranch();

    React.useEffect(() => {
        if (zoomDetectorRef.current) {
            setBaseHeight(zoomDetectorRef.current.clientHeight);
        }
    }, [zoomDetectorRef.current]);

    const ListEntry = (props: SelectableListEntryProps) => (
        <GraphLine
            branches={branches}
            getLine={getLine}
            tags={tags}
            searchTerm={searchTerm}
            onOpenContextMenu={onOpenContextMenu}
            currentBranch={currentBranch}
            {...props}
        />
    );

    return (
        <>
            <SelectableList
                style={{
                    marginTop: '0.5rem',
                }}
                itemSize={baseHeight * 3}
                itemCount={props.totalCommits}
                width={props.width}
                height={props.height}
                onSelectionChange={(selected) => {
                    Promise.all(Array.from(selected.values()).map(async (idx) => (await getLine(idx))?.commit)).then(
                        results => props.onCommitsSelected?.(results));
                }}
                ref={ref}
                multi={props.multi}>
                {ListEntry}
            </SelectableList>
            <ZoomSizeDetector ref={zoomDetectorRef} />
        </>
    );
});
