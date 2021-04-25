import * as React from 'react';
import { Commit, DiffStat } from '../../../model/stateObjects';

import '../../../style/app.css';
import { ArrowRight } from '../icons/ArrowRight';
import { ArrowDown } from '../icons/ArrowDown';
import { StringDiffViewer } from './DiffViewer';
import { FileStatus } from '../shared/FileStatus';
import styled from 'styled-components';
import { Maybe, nothing, just } from '../../../util/maybe';
import { useRepo, useSelectedCommit } from '../../../model/state/repo';
import { Logger } from '../../../util/logger';

export interface CommitProps {
    commit?: Commit;
}

interface BarProps {
    size: number;
    color: string;
}

const Bar = styled.span<BarProps>`
    display: inline-block;
    height: 0.7rem;
    width: ${(props) => props.size}px;
    background-color: ${(props) => props.color};
`;

function ChangesBar(props: { additions: number; deletions: number }) {
    const total = props.additions + props.deletions;
    const totalScale = Math.sqrt(total) * 10;
    const add = (props.additions * totalScale) / total;
    const del = (props.deletions * totalScale) / total;
    return (
        <div>
            <Bar size={add + del} color="#00A000" />
            <Bar size={del} color="#C03030" />
        </div>
    );
}

const CommitHeaderFrame = styled.div`
    border-bottom: 1px dotted ${(props) => props.theme.colors.foreground};
    padding: 0.5rem;
    padding-bottom: 0;
    margin-bottom: 0.5rem;
    user-select: text;
`;

export const CommitMetaData: React.FC<{ commit: Commit }> = (props) => {
    return (
        <>
            <p style={{ margin: 0 }}>
                Author: {props.commit.author.name} &lt;{props.commit.author.email}&gt; (
                {props.commit.author.timestamp.toLocaleString()})
            </p>
            {props.commit.type === 'commit' && (
                <p style={{ margin: 0 }}>
                    Committer: {props.commit.committer.name} &lt;{props.commit.committer.email}&gt;
                    ({props.commit.committer.timestamp.toLocaleString()})
                </p>
            )}
            <p style={{ margin: 0, fontSize: '80%' }}>
                SHA: {props.commit.short_oid} (
                {props.commit.parents.length === 1 ? 'parent ' : 'parents '}
                {props.commit.parents.map((p) => p.short_oid).join(', ')})
            </p>
            <pre style={{ fontFamily: 'inherit', marginLeft: '1rem' }}>{props.commit.message}</pre>
        </>
    );
};

export const CommitHeader: React.FC<{ commit: Commit }> = (props) => {
    return (
        <CommitHeaderFrame>
            {props.commit.type === 'stash' && <h3>{props.commit.ref}</h3>}
            <CommitMetaData commit={props.commit} />
        </CommitHeaderFrame>
    );
};

function FileDiff(props: {
    source: 'commit' | 'stash';
    commit: string;
    diff: DiffStat;
    toParent?: string;
}) {
    const backend = useRepo((state) => state.backend);
    const [open, setOpen] = React.useState(false);
    const [diffString, setDiffString] = React.useState<Maybe<string>>(nothing);
    React.useEffect(() => {
        if (open) {
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
        } else {
            setDiffString(nothing);
        }
    }, [open]);
    return (
        <>
            {props.diff.additions + props.diff.deletions > 0 ? (
                <div onClick={() => setOpen(!open)}>{open ? <ArrowDown /> : <ArrowRight />}</div>
            ) : (
                <div></div>
            )}
            <FileStatus status={props.diff.status} />
            <div
                style={{
                    userSelect: 'text',
                }}>
                {props.diff.oldPath && `${props.diff.oldPath} → `}
                {props.diff.path}
                {/* {props.diff.source && <SourceDisplay>({props.diff.source})</SourceDisplay>} */}
            </div>
            <ChangesBar additions={props.diff.additions} deletions={props.diff.deletions} />
            {open && (
                <div style={{ gridColumn: '1 / span 4', marginRight: '5px' }}>
                    {diffString.found ? (
                        <StringDiffViewer diffString={diffString.value} />
                    ) : (
                        'Loading diff...'
                    )}
                </div>
            )}
        </>
    );
}

function DiffView(props: {
    source: 'commit' | 'stash';
    commit: string;
    diffs: readonly DiffStat[];
    toParent?: string;
}) {
    return (
        <div className="diff-list">
            {props.diffs.map((diff) => (
                <FileDiff
                    source={props.source}
                    key={`${diff.path}-${diff.source}`}
                    commit={props.commit}
                    diff={diff}
                    toParent={props.toParent}
                />
            ))}
        </div>
    );
}

export const CommitDetailsView: React.FC = () => {
    const stats = useSelectedCommit();
    if (stats.found) {
        return (
            <div
                style={{
                    height: '100%',
                    overflow: 'auto',
                }}>
                <CommitHeader commit={stats.value.commit} />
                {stats.value.incoming.found && stats.value.direct.length > 0 && <h2>Conflicts</h2>}
                <DiffView
                    commit={stats.value.commit.oid}
                    diffs={stats.value.direct}
                    source={stats.value.commit.type}
                />
                {stats.value.incoming.found && (
                    <>
                        <h2>Incoming</h2>
                        <DiffView
                            commit={stats.value.commit.oid}
                            diffs={stats.value.incoming.value}
                            source={stats.value.commit.type}
                            toParent={`${stats.value.commit.oid}^`}
                        />
                    </>
                )}
            </div>
        );
    }
    return <div></div>;
};
