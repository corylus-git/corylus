import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { DiffLine, DiffChunk, FileDiff, parse } from '../../../util/diff-parser';
import { Logger } from '../../../util/logger';
import { Maybe, nothing, just } from '../../../util/maybe';

const DiffLineDisplay = styled.div<{ selected: boolean }>`
    font-family: Fira Code;
    font-size: 90%;
    white-space: pre;
    padding-left: 0.5rem;
    background-color: ${(props) =>
        props.selected
            ? props.theme.colors.diff.selected.context
            : props.theme.colors.diff.default.context};
`;

const InsertedLine = styled(DiffLineDisplay)<{ selected: boolean }>`
    background-color: ${(props) =>
        props.selected
            ? props.theme.colors.diff.selected.inserted
            : props.theme.colors.diff.default.inserted};
`;

const DeletedLine = styled(DiffLineDisplay)<{ selected: boolean }>`
    background-color: ${(props) =>
        props.selected
            ? props.theme.colors.diff.selected.deleted
            : props.theme.colors.diff.default.deleted};
`;

const PseudoContextLine = styled(DiffLineDisplay)<{ selected: boolean }>`
    color: ${(props) => props.theme.colors.border};
`;

type MouseLineEventHandler = (
    ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
    blockIndex: number,
    lineIndex: number
) => void;

export const DefaultDiffLine: React.FC<LineRendererProps> = (props) => {
    let Line = DiffLineDisplay;
    switch (props.line.type) {
        case 'insert':
            Line = InsertedLine;
            break;
        case 'delete':
            Line = DeletedLine;
            break;
        case 'pseudo-context':
            Line = PseudoContextLine;
            break;
    }
    return (
        <Line
            selected={!!props.selected}
            onMouseDown={(ev) =>
                props.onLineMouseDown?.(ev, props.parentChunkIndex, props.lineIndex)
            }
            onMouseEnter={(ev) =>
                props.onLineMouseEnter?.(ev, props.parentChunkIndex, props.lineIndex)
            }
            onClick={(ev) => props.onLineClick?.(ev, props.parentChunkIndex, props.lineIndex)}>
            <span>
                {`${props.line.newNumber ?? props.line.oldNumber ?? ''}`.padStart(
                    props.maxLineNumberLength
                )}
            </span>
            <span>{props.line.content}</span>
        </Line>
    );
};

export type ChunkRendererProps = {
    chunk: DiffChunk;
    line: React.FC<LineRendererProps>;
    onLineMouseDown?: MouseLineEventHandler;
    onLineMouseEnter?: MouseLineEventHandler;
    onLineClick?: MouseLineEventHandler;
    chunkIndex: number;
    currentSelection: Maybe<SelectedLines>;
    maxLineNumberLength: number;
};

export type LineRendererProps = {
    line: DiffLine;
    parentChunkIndex: number;
    lineIndex: number;
    onLineMouseDown?: MouseLineEventHandler;
    onLineMouseEnter?: MouseLineEventHandler;
    onLineClick?: MouseLineEventHandler;
    selected?: boolean;
    maxLineNumberLength: number;
};

export interface DiffViewerPropsBase {
    /**
     * The optional chunk render function
     */
    chunk?: React.FC<ChunkRendererProps>;

    /**
     * The optional line render function. Note: if you set the block render function, please make sure
     * to call the line render function as needed.
     */
    line?: React.FC<LineRendererProps>;

    /**
     * does the viewer instance support selecting lines for partial commits?
     */
    selectable?: boolean;

    /**
     * Callback called when opening the context menu in the current diff viewer
     */
    onContextMenu?: (
        ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
        currentSelection?: SelectedLines
    ) => void;
}

const ChunkHeader = styled.div`
    font-size: 90%;
    color: white;
    background-color: #505050;
`;

/**
 * The default block renderer used when no custom renderer is set
 */
export const DefaultBlockRenderer: React.FC<ChunkRendererProps> = (props) => {
    return (
        <div>
            <ChunkHeader>{props.chunk.header}</ChunkHeader>
            {props.chunk.lines.map((line, lineIndex) => (
                <props.line
                    key={`${props.chunkIndex}-${lineIndex}`}
                    line={line}
                    parentChunkIndex={props.chunkIndex}
                    lineIndex={lineIndex}
                    onLineMouseDown={props.onLineMouseDown}
                    onLineMouseEnter={props.onLineMouseEnter}
                    onLineClick={props.onLineClick}
                    maxLineNumberLength={props.maxLineNumberLength}
                />
            ))}
        </div>
    );
};

export type SelectionBoundary = { chunkIndex: number; lineIndex: number };

export type SelectedLines = {
    first: SelectionBoundary;
    last: SelectionBoundary;
};

const DiffViewContainer = styled.div`
    user-select: text;
`;

export const maxLineNumber = (chunks: readonly DiffChunk[]): number =>
    chunks.reduce(
        (currentMax, c) =>
            Math.max(
                c.lines.reduce(
                    (cmax, l) => Math.max(Math.max(l.newNumber ?? 0, l.oldNumber ?? 0), cmax),
                    currentMax
                ),
                currentMax
            ),
        0
    );

export const DiffViewer: React.FC<{ file: FileDiff } & DiffViewerPropsBase> = (props) => {
    const Renderer = props.chunk ?? DefaultBlockRenderer;
    const Line = props.line ?? DefaultDiffLine;
    const [selectedLines, setSelectedLines] = useState<Maybe<SelectedLines>>(nothing);
    const [newSelection, setNewSelection] = useState<boolean>(false);

    useEffect(() => {
        setSelectedLines(nothing);
        setNewSelection(false);
    }, [props.file]);

    function lineMouseDown(
        ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
        chunkIndex: number,
        lineIndex: number
    ) {
        if (ev.buttons === 1) {
            if (!selectedLines.found) {
                // we're starting a new selection and have to prevent the inevitable onClick() from removing single line selections again immediately
                setNewSelection(true);
            }
            setSelectedLines(
                just({
                    first: {
                        chunkIndex: chunkIndex,
                        lineIndex: lineIndex,
                    },
                    last: {
                        chunkIndex: chunkIndex,
                        lineIndex: lineIndex,
                    },
                })
            );
        }
    }

    function normalize(l: SelectedLines): SelectedLines {
        if (
            l.first.chunkIndex < l.last.chunkIndex ||
            (l.first.chunkIndex === l.last.chunkIndex && l.first.lineIndex <= l.last.lineIndex)
        ) {
            return l;
        }
        return {
            first: l.last,
            last: l.first,
        };
    }

    function lineMouseEnter(
        ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
        chunkIndex: number,
        lineIndex: number
    ) {
        if (ev.buttons === 1) {
            if (selectedLines.found) {
                setSelectedLines(
                    just({
                        ...selectedLines.value,
                        last: {
                            chunkIndex: chunkIndex,
                            lineIndex: lineIndex,
                        },
                    })
                );
            }
        }
    }

    function lineClick(
        ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
        blockIndex: number,
        lineIndex: number
    ) {
        if (ev.button === 0 && selectedLines && !newSelection) {
            setSelectedLines(nothing);
        }
    }

    const maxLineNumberLength = Math.floor(Math.log10(maxLineNumber(props.file.chunks))) + 1;

    return (
        <DiffViewContainer
            onContextMenu={(ev) => {
                if (selectedLines.found) {
                    props.onContextMenu?.(ev, selectedLines.value);
                }
            }}
            onClick={() => {
                setNewSelection(false);
            }}>
            {props.file.chunks.map((chunk, chunkIndex) => (
                <Renderer
                    key={chunk.header}
                    chunk={chunk}
                    line={Line}
                    chunkIndex={chunkIndex}
                    onLineMouseDown={props.selectable ? lineMouseDown : undefined}
                    onLineMouseEnter={props.selectable ? lineMouseEnter : undefined}
                    onLineClick={props.selectable ? lineClick : undefined}
                    currentSelection={
                        selectedLines.found ? just(normalize(selectedLines.value)) : nothing
                    }
                    maxLineNumberLength={maxLineNumberLength}
                />
            ))}
        </DiffViewContainer>
    );
};

export const StringDiffViewer: React.FC<{ diffString: string } & DiffViewerPropsBase> = (props) => {
    const parsedDiff = useMemo(() => {
        Logger().silly('StringDiffViewer', 'Parsing diff', { diff: props.diffString });
        return parse(props.diffString);
    }, [props.diffString]);
    return parsedDiff.length > 0 ? (
        <DiffViewer file={parsedDiff[0]} chunk={props.chunk} line={props.line} selectable />
    ) : (
        <></>
    );
};
