import { ControlledMenu, ControlledMenuProps, MenuItem } from '@szhsin/react-menu';
import { invoke } from '@tauri-apps/api';
import * as React from 'react';
import { selectCommit } from '../../model/actions/repo';
import { DialogActions, useDialog } from '../../model/state/dialogs';
import {
    HistoryInfo, useBranches, useSelectedCommit, useTags
} from '../../model/state/repo';
import { BranchInfo, Commit } from '../../model/stateObjects';
import { LayoutListEntry } from '../../util/graphLayout';
import { Maybe } from '../../util/maybe';
import { SearchBox } from '../shared/SearchBox';
import { ListSelector } from '../util/SelectableList';
import { GraphRenderer } from './GraphRenderer';

function matchCommit(c: Commit, searchTerm: string): boolean {
    return (
        c.author.name?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.author.email?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.message?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.shortOid.toLowerCase().indexOf(searchTerm) !== -1 ||
        c.oid.toLowerCase().indexOf(searchTerm) !== -1
    );
}

export const Graph: React.FC<{
    width: number;
    height: number;
    history: HistoryInfo;
}> = (props) => {
    const dialog = useDialog();
    const selectedCommit = useSelectedCommit();
    const [searchTerm, setSearchTerm] = React.useState<string>();
    const [matches, setMatches] = React.useState<number[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = React.useState<number>(0);
    const { data: branches } = useBranches();
    const tags = useTags();
    const listSelector = React.useRef<ListSelector>(null);

    React.useEffect(() => {
        const index = -1; // TODO implement searching in the backend
        // const index = lines.findIndex(
        //     (l) => selectedCommit.found && l.commit.oid === selectedCommit.value.commit.oid
        // );
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
                    const matches: number[] = []; // TODO implement matching in the backend
                        // termLowerCase.length > 0
                        //     ? lines.reduce(
                        //         (existingMatches, current, index) =>
                        //             matchCommit(current.commit, termLowerCase)
                        //                 ? existingMatches.concat(index)
                        //                 : existingMatches,

                        //         [] as number[]
                        //     )
                        //     : [];
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
                getLine={async idx => (await invoke<LayoutListEntry[]>('get_graph_entries', { startIdx: idx, endIdx: idx + 1 }))[0]} // TODO directly request from the backend
                totalCommits={props.history.total}
                first={props.history.first}
                branches={branches ?? []}
                tags={tags}
                onOpenContextMenu={(commit) => {}
                    // openContextMenu(dialog, commit.oid, commit.shortOid, currentBranch)
                }
                onCommitsSelected={(c) => selectCommit(c[0])}
                searchTerm={searchTerm}
                ref={listSelector}
            />
        </>
    );
};
