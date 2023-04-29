import { ControlledMenu, MenuItem, useMenuState } from '@szhsin/react-menu';
import React from 'react';
import styled from 'styled-components';
import { useFiles } from '../../model/state/explorer';
import { Commit, FileStats } from '../../model/stateObjects';
import { Logger } from '../../util/logger';
import { FileStatus } from '../shared/FileStatus';
import { SearchBox } from '../shared/SearchBox';
import { RunningIndicator } from '../util/RunningIndicator';
import { Tree, TreeNode } from '../util/Tree/Tree';
import { insertPath } from '../util/Tree/utils';
// import { Menu, MenuItem, getCurrentWindow } from '@electron/remote';
import { FileHistory } from './FileHistory';

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
    // TODO
    // const menu = Menu.buildFromTemplate([
    //     {
    //         label: 'Show file history',
    //         click: () => {
    //             Logger().debug('FileTree', 'Showing file history', { file: meta.path });
    //             explorer.getState().loadPathHistory(meta.path);
    //         },
    //     },
    //     {
    //         label: 'Annotate edits (blame)',
    //         click: () => {
    //             Logger().debug('FileTree', 'Blame file', { file: meta.path });
    //             explorer.getState().loadBlameInfo(meta.path);
    //         },
    //     },
    // ]);
    // menu.popup({ window: getCurrentWindow() });
}

const FileTree: React.FC<{ files: readonly FileStats[] }> = (props) => {
    const trees = props.files.reduce((existingTree, file) => {
        return insertPath(existingTree, file.path.split(/\//), file);
    }, [] as readonly TreeNode<FileStats>[]);
    const [menuProps, setMenuState] = useMenuState();
    const [meta, setMeta] = React.useState<FileStats>();
    const [anchorPoint, setAnchorPoint] = React.useState<{ x: number, y: number }>();
    return (
        <>
            <ControlledMenu {...menuProps} onClose={() => setMenuState(false)} anchorPoint={anchorPoint}>
                <MenuItem onClick={() => {
                    Logger().debug('FileTree', 'Showing file history', { file: meta!.path });
                    // explorer.getState().loadPathHistory(meta!.path);
                    throw new Error('Not yet ported');
                }}>Show file history</MenuItem>
                <MenuItem>Annotate edits (blame)</MenuItem>
            </ControlledMenu>
            <Scrollable>
                {trees.map((t, i) => (
                    <Tree
                        key={i}
                        root={t}
                        label={(file, path, _, meta) => {
                            return (
                                <span
                                    title={`${path?.join('/') ?? ''}/${file}`}
                                    onContextMenu={(ev) => {
                                        ev.preventDefault();
                                        if (meta) {
                                            setMeta(meta);
                                            setAnchorPoint({ x: ev.clientX, y: ev.clientY });
                                            setMenuState(true);
                                        }
                                    }}>
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
        </>
    );
};

export const ExplorerPanel: React.FC<{ commit?: Commit }> = (props) => {
    const { data: files } = useFiles(props.commit?.oid);
    const [searchTerm, setSearchTerm] = React.useState('');
    return (
        <ExplorerPanelView>
            <div>
                <h1>
                    Files in
                    {props.commit ? ` commit ${props.commit.shortOid}` : ' the working directory'}
                </h1>
                <SearchBox onTermChange={setSearchTerm} isFirst={true} isLast={true} />
                {files ? (
                    <FileTree
                        files={files.filter((f) => f.path.indexOf(searchTerm) !== -1)}
                    />
                ) : (
                    <RunningIndicator active={true} size={2} />
                )}
            </div>
            <FileHistory />
        </ExplorerPanelView>
    );
};
