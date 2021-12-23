import React from 'react';
import { useRepo } from '../../../model/state/repo';
import { Commit, DiffStat } from '../../../model/stateObjects';
import { Logger } from '../../../util/logger';
import { just, Maybe, nothing } from '../../../util/maybe';
import { StringDiffViewer } from './DiffViewer';

export type TextFileDiffProps = {
    source: 'commit' | 'stash';
    diff: DiffStat;
    commit: string;
    toParent?: string;
};

export const TextFileDiff: React.FC<TextFileDiffProps> = (props) => {
    const [diffString, setDiffString] = React.useState<Maybe<string>>(nothing);
    const backend = useRepo((state) => state.backend);
    React.useEffect(() => {
        backend
            .getDiff({
                source: props.source,
                commitId: props.commit,
                toParent: props.toParent,
                path: props.diff.path,
                untracked: props.diff.status === 'untracked',
            })
            .then((result) => {
                Logger().debug('FileDiff', 'Loaded diff', {
                    path: props.diff.path,
                    commit: props.commit,
                    result,
                });
                setDiffString(just(result));
            });
    }, [open, props.commit]);
    return diffString.found ? (
        <StringDiffViewer diffString={diffString.value} />
    ) : (
        <>Loading diff...</>
    );
};
