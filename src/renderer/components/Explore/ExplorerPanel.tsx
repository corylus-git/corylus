import React from 'react';
import { Logger } from '../../../util/logger';
import styled from 'styled-components';
import { Commit, FileStats } from '../../../model/stateObjects';
import { Tree, TreeNode } from '../util/Tree/Tree';
import { RunningIndicator } from '../util/RunningIndicator';
import { insertPath } from '../util/Tree/utils';
import { FileStatus } from '../shared/FileStatus';
import { Menu, MenuItem, getCurrentWindow } from '@electron/remote';
import { FileHistory } from './FileHistory';
import { useFiles, explorer } from '../../../model/state/explorer';
import { SearchBox } from '../shared/SearchBox';
import { repoStore, useRepo } from '../../../model/state/repo';

const ExplorerPanelView = styled.div`
    > div {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: grid;
        padding: 0.5rem;
        grid-template-rows: 3rem 1fr;
        h1 {
            margin-top: 0;
        }
    }
    position: relative;
`;

const Scrollable = styled.div`
    overflow: auto;
`;

function openContextMenu(meta: FileStats) {
    const menu = Menu.buildFromTemplate([
        {
            label: 'Show file history',
            click: () => {
                Logger().debug('FileTree', 'Showing file history', { file: meta.path });
                explorer.getState().loadPathHistory(meta.path);
            },
        },
        {
            label: 'Annotate edits (blame)',
            click: () => {
                Logger().debug('FileTree', 'Blame file', { file: meta.path });
                explorer.getState().loadBlameInfo(meta.path);
            },
        },
    ]);
    menu.popup({ window: getCurrentWindow() });
}

const FileTree: React.FC<{ files: readonly FileStats[] }> = (props) => {
    const trees = props.files.reduce((existingTree, file) => {
        return insertPath(existingTree, file.path.split(/\//), file);
    }, [] as readonly TreeNode<FileStats>[]);
    return (
        <Scrollable>
            {trees.map((t, i) => (
                <Tree
                    key={i}
                    root={t}
                    label={(file, path, _, meta) => {
                        return (
                            <span
                                title={`${path?.join('/') ?? ''}/${file}`}
                                onContextMenu={() => meta && openContextMenu(meta)}>
                                {meta && (
                                    <FileStatus
                                        isConflicted={false}
                                        status={meta.status}
                                        style={{ fontSize: '80%', marginRight: '0.25rem' }}
                                    />
                                )}
                                {file}
                            </span>
                        );
                    }}
                    expanded
                />
            ))}
        </Scrollable>
    );
};

export const ExplorerPanel: React.FC<{ commit?: Commit }> = (props) => {
    const files = useFiles();
    const [searchTerm, setSearchTerm] = React.useState('');
    React.useEffect(() => {
        explorer.getState().reset();
        if (!props.commit) {
            explorer.getState().loadWorkdir();
        }
    }, [props.commit, repoStore.getState().path]);
    return (
        <ExplorerPanelView>
            <div>
                <h1>
                    Files in
                    {props.commit ? ` commit ${props.commit.short_oid}` : ' the working directory'}
                </h1>
                <SearchBox onTermChange={setSearchTerm} isFirst={true} isLast={true} />
                {files.found ? (
                    <FileTree
                        files={files.value.filter((f) => f.path.indexOf(searchTerm) !== -1)}
                    />
                ) : (
                    <RunningIndicator active={true} size={2} />
                )}
            </div>
            <FileHistory />
        </ExplorerPanelView>
    );
};
