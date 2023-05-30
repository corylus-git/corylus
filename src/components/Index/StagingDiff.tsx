import React from 'react';
import { ChunkRendererProps, DiffViewer, SelectedLines, maxLineNumber } from '../Diff/DiffViewer';
import { serializeDiff, modifyDiff } from '../../util/diff';
import styled from 'styled-components';
import { FileDiff } from '../../util/diff-parser';
import { Logger } from '../../util/logger';
import { calculateHighlightAreas } from '../../util/diff-highlighter';

const StagingChunkHeader = styled.div`
    font-size: 90%;
    color: white;
    background-color: #505050;
    display: grid;
    grid-template-columns: 1fr fit-content(10rem) fit-content(10rem);
    grid-column-gap: 0.5rem;
`;

export const StagingDiff: React.FC<{
    diff: FileDiff;
    onAddDiff: (diff: string) => void;
    onDiscardDiff: (diff: string) => void;
    isIndex?: boolean;
}> = (props) => {
    // const parsedDiff = React.useMemo(() => {
    //     return parse(props.diff, 125);
    // }, [props.diff]);
    const { onAddDiff, onDiscardDiff, diff } = props;
    const isIndex = props.isIndex;

    const maxLineNumberLength =
        Math.floor(
            Math.log10(
                (diff && diff.chunks.length > 0 && maxLineNumber(diff.chunks)) || 0
            )
        ) + 1;

    function StagingChunk(props: ChunkRendererProps) {
        const isPartial = props.chunk.lines[props.chunk.lines.length - 1]?.type === 'timeout';
        const highlights = calculateHighlightAreas(props.chunk);
        return (
            <div>
                <StagingChunkHeader>
                    {props.chunk.header}
                    {!isPartial && (
                        <button
                            onClick={() =>
                                onAddDiff(
                                    serializeDiff(
                                        diff.header,
                                        modifyDiff(diff, {
                                            first: {
                                                chunkIndex: props.chunkIndex,
                                                lineIndex: 0,
                                            },
                                            last: {
                                                chunkIndex: props.chunkIndex,
                                                lineIndex: props.chunk.lines.length - 1,
                                            },
                                        }, !!isIndex)
                                    )
                                )
                            }>
                            {isIndex ? 'Unstage chunk' : 'Stage chunk'}
                        </button>
                    )}
                    {!isIndex && !isPartial ? (
                        <button
                            onClick={() =>
                                onDiscardDiff(
                                    serializeDiff(
                                        diff.header,
                                        modifyDiff(diff, {
                                            first: {
                                                chunkIndex: props.chunkIndex,
                                                lineIndex: 0,
                                            },
                                            last: {
                                                chunkIndex: props.chunkIndex,
                                                lineIndex: props.chunk.lines.length - 1,
                                            },
                                        }, !!isIndex)
                                    )
                                )
                            }>
                            Discard chunk
                        </button>
                    ) : (
                        <></>
                    )}
                </StagingChunkHeader>
                {props.chunk.lines.map((line, lineIndex) => (
                    <props.line
                        key={`${lineIndex}-${line.oldNumber}-${line.newNumber}`}
                        line={line}
                        parentChunkIndex={props.chunkIndex}
                        lineIndex={lineIndex}
                        onLineMouseDown={props.onLineMouseDown}
                        onLineMouseEnter={props.onLineMouseEnter}
                        onLineClick={props.onLineClick}
                        selected={
                            props.currentSelection.found &&
                            // are we on or beyond the first selected line?
                            (props.currentSelection.value.first.chunkIndex < props.chunkIndex ||
                                (props.currentSelection.value.first.chunkIndex ===
                                    props.chunkIndex &&
                                    props.currentSelection.value.first.lineIndex <= lineIndex)) &&
                            // are we on or before the last selected line?
                            (props.chunkIndex < props.currentSelection.value.last.chunkIndex ||
                                (props.currentSelection.value.last.chunkIndex ===
                                    props.chunkIndex &&
                                    lineIndex <= props.currentSelection.value.last.lineIndex))
                        }
                        maxLineNumberLength={maxLineNumberLength}
                        highlights={highlights[lineIndex]}
                    />
                ))}
            </div>
        );
    }

    return diff ? (
        <DiffViewer
            file={diff}
            chunk={StagingChunk}
            onContextMenu={(_ev, currentSelection) => {
                if (currentSelection) {
                    const newDiff = serializeDiff(
                        diff.header,
                        modifyDiff(diff, normalize(currentSelection), !!isIndex)
                    );
                    Logger().silly('StagingDiff', 'Adding partial diff', { diff: newDiff });
                    onAddDiff(newDiff);
                }
            }}
            selectable
        />
    ) : (
        <></>
    );
};

function normalize(selection: SelectedLines): SelectedLines {
    if (
        selection.first.chunkIndex > selection.last.chunkIndex ||
        (selection.first.chunkIndex === selection.last.chunkIndex &&
            selection.first.lineIndex > selection.last.lineIndex)
    ) {
        return {
            first: selection.last,
            last: selection.first,
        };
    }
    return selection;
}
