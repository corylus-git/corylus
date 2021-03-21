import * as React from 'react';
import styled from 'styled-components';
import { CommitInfo } from './CommitInfo';
import { HoverableDiv } from '../StyleBase';
import { Commit } from '../../../model/stateObjects';
import { GraphNode } from './GraphNode';
import { RailLine } from './RailLine';
import { FixedSizeList as List } from 'react-window';
import { remote } from 'electron';
import { SearchBox } from '../shared/SearchBox';
import { map, Maybe, just, nothing } from '../../../util/maybe';
import { DialogActions, useDialog } from '../../../model/state/dialogs';
import {
    useBranches,
    useCurrentBranch,
    useTags,
    useSelectedCommit,
    useRepo,
    RepoActions,
    HistoryInfo,
} from '../../../model/state/repo';
import { useGraph } from '../../../model/state/graph';
import { GraphLayoutData } from '../../../util/graphLayout';

const { Menu, MenuItem } = remote;

const CommitMessage = styled.div`
    flex-grow: 1;
`;

const CommitEntry = styled(HoverableDiv)<{ isCurrent?: boolean }>`
    display: flex;
    min-height: 3rem;
    background-color: ${(props) => (props.isCurrent ? props.theme.colors.selected : undefined)};
`;

function openContextMenu(
    dialog: DialogActions,
    ref: string,
    shortRef: string,
    currentBranch: Maybe<string>
) {
    const menu = Menu.buildFromTemplate([
        {
            label: `Create branch from ${shortRef}`,
            click: () =>
                dialog.open({
                    type: 'request-new-branch',
                    subType: 'commit',
                    source: just(ref),
                    branchPrefix: nothing,
                }),
        },
        {
            label: `Merge ${shortRef} into ${currentBranch.found && currentBranch.value}`,
            click: () => dialog.open({ type: 'request-merge', source: just(ref) }),
        },
        {
            label: `Create tag at ${shortRef}`,
            click: () => dialog.open({ type: 'request-create-tag', ref: ref }),
        },
        {
            label: 'Rebase current branch here',
            click: () => dialog.open({ type: 'rebase', target: ref }),
        },
        {
            label: 'Interactively rebase current branch here',
            click: () => dialog.open({ type: 'interactive-rebase', target: ref }),
        },
    ]);
    if (currentBranch.found) {
        menu.append(
            new MenuItem({
                label: `Reset ${currentBranch.found && currentBranch.value} to ${shortRef}`,
                click: () =>
                    dialog.open({
                        type: 'request-branch-reset',
                        branch: currentBranch.value,
                        toRef: ref,
                    }),
            })
        );
    }
    menu.popup({ window: remote.getCurrentWindow() });
}

function matchCommit(c: Commit, searchTerm: string): boolean {
    return (
        c.author.name?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.author.email?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.message?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.short_oid.toLowerCase().indexOf(searchTerm) !== -1
    );
}

export interface SizableControlProps {
    width: number;
    height: number;
}

export const GraphRenderer: React.FC<
    SizableControlProps & GraphLayoutData & { totalCommits: number; first: number }
> = (props) => {
    const dialog = useDialog();
    const currentBranch = useCurrentBranch();
    const selectedCommit = useSelectedCommit();
    const setSelectedCommit = useRepo((s) => s.selectCommit);
    const listRef = React.createRef<List>();
    const [searchTerm, setSearchTerm] = React.useState<string>();
    const [matches, setMatches] = React.useState<number[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = React.useState<number>(0);
    const branches = useBranches();
    const tags = useTags();
    const lines = props.lines;

    React.useEffect(() => {
        matches.length !== 0 && listRef.current?.scrollToItem(matches[currentMatchIndex], 'center');
    }, [matches, currentMatchIndex]);
    React.useEffect(() => {
        const index = lines.findIndex(
            (l) => selectedCommit.found && l.commit.oid === selectedCommit.value.commit.oid
        );
        if (index !== -1) {
            listRef.current?.scrollToItem(index, 'center');
        }
    }, [selectedCommit]);

    const commitSelected = (commit: Commit) => {
        setSelectedCommit(commit);
    };

    const ListEntry = (props: { index: number; style: any }) => {
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
                onContextMenu={() =>
                    openContextMenu(
                        dialog,
                        e.commit.oid,
                        e.commit.short_oid,
                        map(currentBranch, (branch) => branch.ref)
                    )
                }
                isCurrent={
                    selectedCommit.found && e.commit.oid === selectedCommit.value.commit.oid
                }>
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
                        onCommitSelect={commitSelected}
                        rail={e.rail}
                        searchTerm={searchTerm}
                    />
                </CommitMessage>
            </CommitEntry>
        );
    };

    return (
        <>
            <SearchBox
                onTermChange={(term) => {
                    const termLowerCase = term.toLocaleLowerCase();
                    const matches =
                        termLowerCase.length > 0
                            ? lines.reduce(
                                  (existingMatches, current, index) =>
                                      matchCommit(current.commit, termLowerCase)
                                          ? existingMatches.concat(index)
                                          : existingMatches,

                                  [] as number[]
                              )
                            : [];
                    setMatches(matches);
                    setCurrentMatchIndex(0);
                    if (matches.length !== 0) {
                        setSearchTerm(term);
                    } else {
                        setSearchTerm(undefined);
                    }
                }}
                isFirst={currentMatchIndex === 0}
                isLast={currentMatchIndex === matches.length - 1}
                onNext={() => setCurrentMatchIndex(currentMatchIndex + 1)}
                onPrevious={() => setCurrentMatchIndex(currentMatchIndex - 1)}
            />
            <List
                style={{
                    marginTop: '0.5rem',
                }}
                itemSize={48}
                itemCount={props.totalCommits}
                width={props.width}
                height={props.height}
                ref={listRef}>
                {ListEntry}
            </List>
        </>
    );
};

export const Graph: React.FC<{
    width: number;
    height: number;
    history: HistoryInfo;
}> = (props) => {
    const entries = useGraph();

    return (
        <GraphRenderer
            width={props.width}
            height={props.height}
            lines={entries.lines}
            rails={entries.rails}
            totalCommits={props.history.historySize}
            first={props.history.first}
        />
    );
};
