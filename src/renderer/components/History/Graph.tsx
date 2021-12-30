import * as React from 'react';
import styled from 'styled-components';
import { CommitInfo } from './CommitInfo';
import { HoverableDiv } from '../StyleBase';
import { BranchInfo, Commit } from '../../../model/stateObjects';
import { GraphNode } from './GraphNode';
import { RailLine } from './RailLine';
import { FixedSizeList as List } from 'react-window';
import { Menu, MenuItem, getCurrentWindow } from '@electron/remote';
import { SearchBox } from '../shared/SearchBox';
import { map, Maybe, just, nothing } from '../../../util/maybe';
import { DialogActions, useDialog } from '../../../model/state/dialogs';
import {
    useBranches,
    useCurrentBranch,
    useTags,
    useSelectedCommit,
    useRepo,
    HistoryInfo,
} from '../../../model/state/repo';
import { useGraph } from '../../../model/state/graph';
import { GraphLayoutData } from '../../../util/graphLayout';
import { changeBranch } from '../../../model/actions/repo';
import { ListSelector, SelectableList, SelectableListEntryProps } from '../util/SelectableList';
import { GraphRenderer } from './GraphRenderer';

function openContextMenu(
    dialog: DialogActions,
    ref: string,
    shortRef: string,
    currentBranch: Maybe<BranchInfo>
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
            label: `Merge ${shortRef} into ${currentBranch.found && currentBranch.value.ref}`,
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

    if (currentBranch.found && currentBranch.value.head !== ref) {
        menu.append(
            new MenuItem({
                label: `Checkout ${shortRef} as detached HEAD`,
                click: () => changeBranch(ref),
            })
        );
    }
    if (currentBranch.found) {
        menu.append(
            new MenuItem({
                label: `Reset ${currentBranch.found && currentBranch.value.ref} to ${shortRef}`,
                click: () =>
                    dialog.open({
                        type: 'request-branch-reset',
                        branch: currentBranch.value.ref,
                        toRef: ref,
                    }),
            })
        );
    }
    menu.popup({ window: getCurrentWindow() });
}

function matchCommit(c: Commit, searchTerm: string): boolean {
    return (
        c.author.name?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.author.email?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.message?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.short_oid.toLowerCase().indexOf(searchTerm) !== -1 ||
        c.oid.toLowerCase().indexOf(searchTerm) !== -1
    );
}

export const Graph: React.FC<{
    width: number;
    height: number;
    history: HistoryInfo;
}> = (props) => {
    const entries = useGraph();
    const dialog = useDialog();
    const currentBranch = useCurrentBranch();
    const selectedCommit = useSelectedCommit();
    const setSelectedCommit = useRepo((s) => s.selectCommit);
    const [searchTerm, setSearchTerm] = React.useState<string>();
    const [matches, setMatches] = React.useState<number[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = React.useState<number>(0);
    const branches = useBranches();
    const tags = useTags();
    const lines = entries.lines;
    const listSelector = React.useRef<ListSelector>(null);

    React.useEffect(() => {
        const index = lines.findIndex(
            (l) => selectedCommit.found && l.commit.oid === selectedCommit.value.commit.oid
        );
        if (index !== -1) {
            listSelector.current?.scrollToItem(index);
            listSelector.current?.selectItems([index]);
        }
    }, [selectedCommit]);
    React.useEffect(() => {
        const index = matches[currentMatchIndex];
        if (index !== undefined) {
            listSelector.current?.scrollToItem(index);
        }
    }, [currentMatchIndex, matches]);

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
            <GraphRenderer
                width={props.width}
                height={props.height}
                lines={entries.lines}
                rails={entries.rails}
                totalCommits={props.history.historySize}
                first={props.history.first}
                branches={branches}
                tags={tags}
                onOpenContextMenu={(commit) =>
                    openContextMenu(dialog, commit.oid, commit.short_oid, currentBranch)
                }
                onCommitsSelected={(c) => setSelectedCommit(c[0])}
                searchTerm={searchTerm}
                ref={listSelector}
            />
        </>
    );
};
