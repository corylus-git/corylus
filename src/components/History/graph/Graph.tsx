import { ControlledMenu, ControlledMenuProps, MenuItem } from '@szhsin/react-menu';
import { invoke } from '@tauri-apps/api';
import * as React from 'react';
import { selectCommit } from '../../../model/actions/repo';
import { DialogActions, useDialog } from '../../../model/state/dialogs';
import {
    useBranches, useHistorySize, useSelectedCommit, useTags
} from '../../../model/state/repo';
import { BranchInfo, Commit } from '../../../model/stateObjects';
import { LayoutListEntry } from '../../../util/graphLayout';
import { Maybe, toOptional } from '../../../util/maybe';
import { SearchBox } from '../../shared/SearchBox';
import { ListSelector } from '../../util/SelectableList';
import { GraphRenderer } from './GraphRenderer';
import { CommitStatsData } from '../../../model/stateObjects';
import { Logger } from '../../../util/logger';
import { getGraphEntries } from '../../../model/state/graph';

function matchCommit(c: Commit, searchTerm: string): boolean {
    return (
        c.author.name?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.author.email?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.message?.toLocaleLowerCase().indexOf(searchTerm) !== -1 ||
        c.shortOid.toLowerCase().indexOf(searchTerm) !== -1 ||
        c.oid.toLowerCase().indexOf(searchTerm) !== -1
    );
}

const Graph: React.FC<{
    width: number;
    height: number;
    historySize: number;
}> = (props) => {
    const selectedCommit = useSelectedCommit();
    const [searchTerm, setSearchTerm] = React.useState<string>();
    const [matches, setMatches] = React.useState<number[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = React.useState<number>(0);
    const { data: branches } = useBranches();
    const tags = useTags();
    const listSelector = React.useRef<ListSelector>(null);

    React.useEffect(() => {
        Logger().debug('Graph', 'Requesting index for commit', { commit: selectedCommit });
        const sc = toOptional(selectedCommit) as CommitStatsData | undefined;
        const indexPromise = sc?.commit ? invoke<number | undefined>('get_index', { oid: sc.commit.oid }) : Promise.resolve(undefined);
        indexPromise.then(index => {
            Logger().debug('Graph', 'Got index for commit', { oid: sc?.commit.oid, idx: index });
            if (index !== undefined) {
                listSelector.current?.scrollToItem(index);
                listSelector.current?.selectItems([index]);
            }
        })
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
                getLine={async idx => {
                    console.log('getLine', '------------ getting line', { idx });
                    return (await getGraphEntries(idx, idx + 1))[0]
                }
                } // TODO directly request from the backend
                totalCommits={props.historySize}
                first={0}
                branches={branches ?? []}
                tags={tags}
                onOpenContextMenu={(commit) => { }
                    // openContextMenu(dialog, commit.oid, commit.shortOid, currentBranch)
                }
                onCommitsSelected={(c) => selectCommit(c[0])}
                searchTerm={searchTerm}
                ref={listSelector}
            />
        </>
    );
};

export const GraphPanel: React.FC<{
    width: number;
    height: number;
}> = (props) => {
    const historySize = useHistorySize();
    Logger().silly('GraphPanel', 'Got history size', { historySize: historySize.data });
    if (historySize.data) {
        return <Graph {...props} historySize={historySize.data} />;
    }
    return <></>;
}