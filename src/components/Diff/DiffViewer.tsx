import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { calculateHighlightAreas, Highlights } from '../../util/diff-highlighter';
import { DiffLine, DiffChunk, FileDiff, parse } from '../../util/diff-parser';
import { Logger } from '../../util/logger';
import { Maybe, nothing, just } from '../../util/maybe';

const DiffLineDisplay = styled.div`
    font-family: Fira Code;
    font-size: 90%;
    white-space: pre;
    padding-left: 0.5rem;
`;

type MouseLineEventHandler = (
    ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
    blockIndex: number,
    lineIndex: number
) => void;

export const DefaultDiffLine: React.FC<LineRendererProps> = (props) => {
    let className = 'diff-context';
    switch (props.line.type) {
        case 'insert':
        case 'delete':
            className = `diff-${props.line.type}`;
            break;
        case 'pseudoContext':
            className = 'pseudo-context';
            break;
        case 'timeout':
            className = 'timeout';
            break;
    }
    if (props.highlights.spans.every((s) => s.highlight)) {
        // if all spans are highlighted, we highlight the whole line instead of only the text
        className += ` ${className}-highlight`;
    }
    if (props.selected) {
        className += ' selected';
    }
    return (
        <DiffLineDisplay
            className={className}
            onMouseDown={(ev) =>
                props.onLineMouseDown?.(ev, props.parentChunkIndex, props.lineIndex)
            }
            onMouseEnter={(ev) =>
                props.onLineMouseEnter?.(ev, props.parentChunkIndex, props.lineIndex)
            }
            onClick={(ev) => props.onLineClick?.(ev, props.parentChunkIndex, props.lineIndex)}>
            <span className="line-number">
                {`${props.line.newNumber ?? props.line.oldNumber ?? ''}`.padStart(
                    props.maxLineNumberLength
                )}
            </span>
            {props.highlights.spans.map((s, i) => (
                <span
                    key={`s-${i}`}
                    className={s.highlight ? `diff-${props.line.type}-highlight` : undefined}>
                    {s.content}
                </span>
            ))}
        </DiffLineDisplay>
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
    highlights: Highlights;
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
    const highlights = calculateHighlightAreas(props.chunk);
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
                    highlights={highlights[lineIndex]}
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
        return parse(props.diffString, 125);
    }, [props.diffString]);
    return parsedDiff.length > 0 ? (
        <DiffViewer file={parsedDiff[0]} chunk={props.chunk} line={props.line} selectable />
    ) : (
        <></>
    );
};
