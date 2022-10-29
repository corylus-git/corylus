import { Splitter } from '../util/Splitter';
import { IndexStatus } from '../../model/stateObjects';
import React from 'react';
import { IndexTree, IndexTreeNode } from './IndexTree';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';

const StagingHeaders = styled.h1`
    font-size: 1.2rem;
    margin-top: 0;
    margin-left: 0.1rem;
    margin-right: 0.1rem;
    height: 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: row;
    padding-top: 0.3rem;
    padding-bottom: 0.3rem;

    span {
        flex: 1;
    }
`;

const AllButton = styled(StyledButton)`
    font-weight: bold;
    font-size: 1.1rem;
    padding-top: 0;
    border: 0;
`;

let splitterY: string | undefined = undefined;

export const StagingArea: React.FC<{
    workdir: IndexStatus[] | undefined;
    staged: IndexStatus[] | undefined;
    onStagePath: (entry: IndexTreeNode) => void;
    onUnstagePath: (entry: IndexTreeNode) => void;
    onSelectWorkdirEntry: (entry: IndexTreeNode) => void;
    onSelectIndexEntry: (entry: IndexTreeNode) => void;
}> = (props) => {
    return (
        <Splitter horizontal initialPosition={splitterY} onMove={(pos) => (splitterY = `${pos}px`)}>
            <div
                style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateRows: 'fit-content(1rem) 1fr',
                    height: '100%',
                }}>
                <StagingHeaders style={{ marginTop: '5px' }}>
                    <span>Changes</span>
                    <AllButton
                        title="Stage all"
                        onClick={() =>
                            props.onStagePath({
                                type: 'dir',
                                path: '.',
                                workdirStatus: 'modified',
                                indexStatus: 'unknown',
                                isConflicted: false,
                                isStaged: false,
                            })
                        }>
                        ⇩
                    </AllButton>
                </StagingHeaders>
                <div style={{ overflow: 'auto', height: '100%' }}>
                    {props.workdir === undefined ? (
                        'Loading status...'
                    ) : (
                        <IndexTree
                            files={props.workdir}
                            isIndex={false}
                            onEntryDoubleClick={props.onStagePath}
                            onEntryClick={props.onSelectWorkdirEntry}
                        />
                    )}
                </div>
            </div>
            <div>
                <StagingHeaders>
                    <span>Staged</span>
                    <AllButton
                        title="Unstage all"
                        onClick={() =>
                            props.onUnstagePath({
                                type: 'dir',
                                path: '.',
                                workdirStatus: 'modified',
                                indexStatus: 'unknown',
                                isConflicted: false,
                                isStaged: true,
                            })
                        }>
                        ⇧
                    </AllButton>
                </StagingHeaders>
                {props.staged === undefined ? (
                    'Loading status...'
                ) : (
                    <IndexTree
                        files={props.staged}
                        isIndex
                        onEntryDoubleClick={props.onUnstagePath}
                        onEntryClick={props.onSelectIndexEntry}
                    />
                )}
            </div>
        </Splitter>
    );
};
