import React from 'react';
import styled from 'styled-components';
import { BranchInfo, Commit, Tag } from '../../../model/stateObjects';
import { GraphLayoutData } from '../../../util/graphLayout';
import { HoverableDiv } from '../StyleBase';
import { ListSelector, SelectableList, SelectableListEntryProps } from '../util/SelectableList';
import { CommitInfo } from './CommitInfo';
import { GraphNode } from './GraphNode';
import { RailLine } from './RailLine';

const CommitMessage = styled.div`
    flex-grow: 1;
`;

const CommitEntry = styled(HoverableDiv)<{ isSelected?: boolean }>`
    display: flex;
    min-height: 3rem;
    background-color: ${(props) => (props.isSelected ? 'var(--selected)' : undefined)};
`;

export interface SizableControlProps {
    width: number;
    height: number;
}

export type GraphRendererProps = {
    totalCommits: number;
    first: number;
    branches: readonly BranchInfo[];
    tags: readonly Tag[];
    searchTerm?: string;
    centerItem?: number;
    onOpenContextMenu?: (commit: Commit) => void;
    onCommitsSelected?: (commits: readonly Commit[]) => void;
} & GraphLayoutData &
    SizableControlProps;

export const GraphRenderer = React.forwardRef<ListSelector, GraphRendererProps>((props, ref) => {
    const { lines, branches, tags, searchTerm, onOpenContextMenu } = props;

    const ListEntry: React.FC<SelectableListEntryProps> = (props) => {
        const e = lines![props.index];
        if (!e) {
            return <></>;
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
                onContextMenu={() => onOpenContextMenu?.(e.commit)}
                isSelected={props.selected}>
                <RailLine size={width}>
                    <GraphNode
                        rail={e.rail}
                        hasChild={e.hasChild}
                        hasParent={e.hasParent}
                        incoming={e.incoming}
                        outgoing={e.outgoing}
                        rails={e.rails}
                    />
                </RailLine>
                <CommitMessage>
                    <CommitInfo
                        commit={e.commit}
                        branches={branches}
                        tags={tags}
                        rail={e.rail}
                        searchTerm={searchTerm}
                    />
                </CommitMessage>
            </CommitEntry>
        );
    };

    return (
        <>
            <SelectableList
                style={{
                    marginTop: '0.5rem',
                }}
                itemSize={48}
                itemCount={props.totalCommits}
                width={props.width}
                height={props.height}
                onSelectionChange={(selected) => {
                    props.onCommitsSelected?.(
                        Array.from(selected.values()).map((idx) => lines![idx]?.commit)
                    );
                }}
                ref={ref}>
                {ListEntry}
            </SelectableList>
        </>
    );
});
