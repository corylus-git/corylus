import React from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { BranchInfo, Commit, Tag } from '../../model/stateObjects';
import { GraphLayoutData, LayoutListEntry } from '../../util/graphLayout';
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

export const GraphLine: React.FC<SelectableListEntryProps & GraphLineProps> = (props) => {
    const { isLoading, error, data: e } = useQuery(["graphLine", props.index], () => props.getLine(props.index));
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
        <CommitEntry
            key={e.commit.oid}
            style={props.style}
            onContextMenu={() => props.onOpenContextMenu?.(e.commit)}
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
    );
};

export const GraphRenderer = React.forwardRef<ListSelector, GraphRendererProps>((props, ref) => {
    const { getLine, branches, tags, searchTerm, onOpenContextMenu } = props;
	const zoomDetectorRef = React.useRef();
	const [baseHeight, setBaseHeight] = React.useState(16);

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
            {...props}
        />
    );

    return (
        <>
            <SelectableList
                style={{
                    marginTop: '0.5rem',
                }}
                itemSize={baseHeight*3}
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
