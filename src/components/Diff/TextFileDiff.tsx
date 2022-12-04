import React from 'react';
import { useDiff } from '../../model/state/repo';
import { DiffStat } from '../../model/stateObjects';
import { DiffViewer } from './DiffViewer';

export type TextFileDiffProps = {
    source: 'commit' | 'stash';
    diff: DiffStat;
    commit: string;
    toParent?: string;
};

export const TextFileDiff: React.FC<TextFileDiffProps> = (props) => {
    const { isLoading, error, data } = useDiff(props.source, props.diff.file.path, props.commit, props.toParent, props.diff.file.status === 'untracked');
    
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
