import React from 'react';
import { StagingDiff } from './StagingDiff';
import { Logger } from '../../util/logger';
import { Maybe } from '../../util/maybe';
import { discardDiff } from '../../model/actions/repo';
import { FileDiff } from '../../util/diff-parser';
import { useDiff } from '../../model/state/repo';

export const StagingDiffPanel: React.FC<{
    file: { path: string; source: 'workdir' | 'index' };
    onAddDiff: (diff: string, path: string, source: 'workdir' | 'index', isIndex: boolean) => void;
}> = (props) => {
    const { isLoading, error, data } = useDiff(props.file.source, props.file.path, undefined, undefined, undefined);
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
                        props.file.path,
                        props.file.source,
                        props.file.source === 'index'
                    )
                }
                onDiscardDiff={(diff) => discardDiff(props.file.path, diff)}
                isIndex={props.file.source === 'index'}
            />
        </>
    ) : (
        <>Loading diff...</>
    );
};
