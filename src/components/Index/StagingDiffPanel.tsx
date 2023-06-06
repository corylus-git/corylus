import React from 'react';
import { StagingDiff } from './StagingDiff';
import { applyDiff, discardDiff } from '../../model/actions/repo';
import { invalidateDiffQuery, useDiff } from '../../model/state/repo';

export const StagingDiffPanel: React.FC<{
    file: { path: string; source: 'workdir' | 'index', untracked: boolean };
    onAddDiff: (diff: string, path: string) => Promise<void>;
}> = (props) => {
    const { isLoading, error, data } = useDiff(props.file.source, props.file.path, undefined, undefined, props.file.untracked);
    if (error) {
        return <div>Failed to load diff</div>
    }
    if (isLoading) {
        return <div>Loading diff...</div>
    }
    return <>
        <h1 style={{ fontSize: '150%' }}>
            {props.file.path} @{props.file.source === 'workdir' ? 'Working directory' : 'Index'}
        </h1>
        {
            data !== undefined && data.length > 0 ? (
                <>

                    <StagingDiff
                        diff={data[0]}
                        onAddDiff={async (diff) => {
                            await props.onAddDiff(
                                diff,
                                props.file.path);
                            invalidateDiffQuery(props.file.source, props.file.path, undefined, undefined, props.file.untracked);
                        }}
                        onDiscardDiff={async (diff) => {
                            await applyDiff(diff, props.file.path, true);
                            invalidateDiffQuery(props.file.source, props.file.path, undefined, undefined, props.file.untracked);
                        }}
                        isIndex={props.file.source === 'index'}
                    />
                </>
            ) : (
                <div>Empty diff</div>
            )
        }
    </>
};
