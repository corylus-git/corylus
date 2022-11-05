import React from 'react';
import { useQuery } from 'react-query';
import { getDiff } from '../../model/actions/repo';
import { DiffStat } from '../../model/stateObjects';
import { DiffViewer, StringDiffViewer } from './DiffViewer';

export type TextFileDiffProps = {
    source: 'commit' | 'stash';
    diff: DiffStat;
    commit: string;
    toParent?: string;
};

export const TextFileDiff: React.FC<TextFileDiffProps> = (props) => {
    const { isLoading, error, data } = useQuery(['diff', props.commit, props.diff.file.path], () => getDiff({
            source: props.source,
            commitId: props.commit,
            toParent: props.toParent,
            path: props.diff.file.path,
            untracked: props.diff.file.status === 'untracked',
        })
    );
    if (isLoading) {
        return <>Loading diff...</>
    }
    if (error) {
        return <>Could not load diff.</>
    }
    if (data) {
        return <DiffViewer file={data[0]} selectable />
    }
    return <></>;
};
