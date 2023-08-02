import { ControlledMenu, ControlledMenuProps, MenuItem } from '@szhsin/react-menu';
import React from 'react';
import styled from 'styled-components';
import { changeBranch } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';
import { useCurrentBranch } from '../../../model/state/repo';
import { BranchInfo, Commit, Tag } from '../../../model/stateObjects';
import { LayoutListEntry } from '../../../util/graphLayout';
import { just, nothing } from '../../../util/maybe';
import { HoverableDiv } from '../../StyleBase';
import { ListSelector, SelectableList, SelectableListEntryProps } from '../../util/SelectableList';
import { x } from './RailLine';
import { GraphLine } from './GraphLine';

export const CommitMessage = styled.div`
    flex-grow: 1;
`;

export const CommitEntry = styled(HoverableDiv) <{ isSelected?: boolean }>`
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
            currentBranch={currentBranch.data}
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
