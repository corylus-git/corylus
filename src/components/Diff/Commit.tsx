import * as React from 'react';
import styled from 'styled-components';

import { Commit, CommitStats, DiffStat, formatTimestamp } from '../../model/stateObjects';
import '../../style/app.css';
import { ArrowRight } from '../icons/ArrowRight';
import { ArrowDown } from '../icons/ArrowDown';
import { FileStatus } from '../shared/FileStatus';
import { ImageDiff } from './ImageDiff';
import { TextFileDiff } from './TextFileDiff';
import { getMimeType, isSupportedImageType } from '../../util/filetypes';
import { Maybe } from '../../util/maybe';

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
    border-bottom: 1px dotted var(--foreground);
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
                {formatTimestamp(props.commit.author.timestamp)})
            </p>
            {props.commit.type === 'commit' && (
                <p style={{ margin: 0 }}>
                    Committer: {props.commit.committer.name} &lt;{props.commit.committer.email}&gt;
                    ({formatTimestamp(props.commit.committer.timestamp)})
                </p>
            )}
            <p style={{ margin: 0, fontSize: '80%' }}>
                SHA: {props.commit.shortOid} (
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
            {props.commit.type === 'stash' && <h3>{props.commit.refName}</h3>}
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
    const [open, setOpen] = React.useState(false);
    // const mimeType = 'text/plain';
    const mimeType = getMimeType(props.diff.file.path);
    // TODO this breaks because mime.lookup seems to use extname internally which is not available in Tauri
    // const mimeType = mime.lookup(props.diff.file.path) || 'text/plain';

    return (
        <>
            {props.diff.additions + props.diff.deletions > 0 || mimeType ? (
                <div onClick={() => setOpen(!open)}>{open ? <ArrowDown /> : <ArrowRight />}</div>
            ) : (
                <div></div>
            )}
            <FileStatus status={props.diff.file.status} />
            <div
                style={{
                    userSelect: 'text',
                }}>
                {props.diff.oldPath && `${props.diff.oldPath} → `}
                {props.diff.file.path}
                {/* {props.diff.source && <SourceDisplay>({props.diff.source})</SourceDisplay>} */}
            </div>
            <ChangesBar additions={props.diff.additions} deletions={props.diff.deletions} />
            {open && (
                <div style={{ gridColumn: '1 / span 4', marginRight: '5px' }}>
                    {isSupportedImageType(mimeType) ? (
                        <ImageDiff
                            oldPath={props.diff.oldPath ?? props.diff.file.path}
                            newPath={props.diff.file.path}
                            oldRef={`${props.commit}^`}
                            newRef={props.commit}
                        />
                    ) : (
                        <TextFileDiff {...props} />
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
                    key={`${diff.file.path}-${diff.source}`}
                    commit={props.commit}
                    diff={diff}
                    toParent={props.toParent}
                />
            ))}
        </div>
    );
}

export type CommitDetailsViewProps = {
    stats: Maybe<CommitStats>;
};

// TODO this needs cleaning up and split into two components
export const CommitDetailsView: React.FC<CommitDetailsViewProps> = (props) => {
    const { stats } = props

    if (stats.found) {
        if (stats.value.type === 'commit') {
            return (
                <div
                    style={{
                        height: '100%',
                        overflow: 'auto',
                    }}>
                    <CommitHeader commit={stats.value.commit} />
                    {stats.value.incoming && stats.value.direct.length > 0 && <h2>Conflicts</h2>}
                    <DiffView
                        commit={stats.value.commit.oid}
                        diffs={stats.value.direct}
                        source="commit"
                    />
                    {stats.value.incoming && (
                        <>
                            <h2>Incoming</h2>
                            <DiffView
                                commit={stats.value.commit.oid}
                                diffs={stats.value.incoming}
                                source="commit"
                                toParent={`${stats.value.commit.oid}^2`}
                            />
                        </>
                    )}
                </div>
            );
        } else {
            return (
                <div
                    style={{
                        height: '100%',
                        overflow: 'auto',
                    }}>
                    <CommitHeader commit={stats.value.stash} />
                    <h2>Changes</h2>
                    <DiffView
                        commit={stats.value.stash.oid}
                        diffs={stats.value.changes}
                        source="stash"
                    />
                    {stats.value.index && stats.value.index.length > 0 && (
                        <>
                            <h2>Index</h2>
                            <DiffView
                                commit={stats.value.stash.oid}
                                diffs={stats.value.index}
                                source="stash"
                                toParent={`${stats.value.stash.oid}^`} // TODO this breaks when loading the actual diff -> need to figure out how to track the actual diff info
                            />
                        </>
                    )}
                    {stats.value.untracked && stats.value.untracked.length > 0 && (
                        <>
                            <h2>Untracked Files</h2>
                            <DiffView
                                commit={stats.value.stash.oid}
                                diffs={stats.value.untracked}
                                source="stash"
                            />
                        </>
                    )}
                </div>
            );
        }
    }
    return <div></div>;
};
