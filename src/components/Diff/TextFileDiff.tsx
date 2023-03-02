import React from 'react';
import { useDiff } from '../../model/state/repo';
import { DiffStat } from '../../model/stateObjects';
import { Logger } from '../../util/logger';
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
    if (data && data.length > 0) {
        return <DiffViewer file={data[0]} selectable />
    }
    Logger().error('TextFileDiff', 'Received empty diff from the backend', { props });
    return <>Internal error loading the diff</>;
};
