import React from 'react';
import { StagingDiff } from './StagingDiff';
import { applyDiff, discardDiff } from '../../model/actions/repo';
import { useDiff } from '../../model/state/repo';

export const StagingDiffPanel: React.FC<{
    file: { path: string; source: 'workdir' | 'index', untracked: boolean };
    onAddDiff: (diff: string, path: string) => void;
}> = (props) => {
    const { isLoading, error, data } = useDiff(props.file.source, props.file.path, undefined, undefined, props.file.untracked);
    if (error) {
        return <div>Failed to load diff</div>
    }
    if (isLoading) {
        return <div>Loading diff...</div>
    }
    return data !== undefined && data.length > 0 ? (
        <>
            <h1 style={{ fontSize: '150%' }}>
                {props.file.path} @{props.file.source === 'workdir' ? 'Working directory' : 'Index'}
            </h1>
            <StagingDiff
                diff={data[0]}
                onAddDiff={(diff) =>
                    props.onAddDiff(
                        diff,
                        props.file.path)
                }
                onDiscardDiff={(diff) => applyDiff(diff, props.file.path, true)}
                isIndex={props.file.source === 'index'}
            />
        </>
    ) : (
        <div>Empty diff</div>
    );
};
