import React from 'react';
import { StagingDiff } from './StagingDiff';
import { Logger } from '../../util/logger';
import { Maybe } from '../../util/maybe';
import { discardDiff } from '../../model/actions/repo';

export const StagingDiffPanel: React.FC<{
    file: { path: string; source: 'workdir' | 'index' };
    diff: Maybe<string>;
    onAddDiff: (diff: string, path: string, source: 'workdir' | 'index', isIndex: boolean) => void;
}> = (props) => {
    Logger().silly('StagingDiffPanel', 'Displaying diff', { unparsed: props.diff });
    return props.diff.found ? (
        <>
            <h1 style={{ fontSize: '150%' }}>
                {props.file.path} @{props.file.source === 'workdir' ? 'Working directory' : 'Index'}
            </h1>
            <StagingDiff
                diff={props.diff.value}
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
