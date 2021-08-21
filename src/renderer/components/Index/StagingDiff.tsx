import React from 'react';
import { ChunkRendererProps, DiffViewer, SelectedLines, maxLineNumber } from '../Diff/DiffViewer';
import { serializeDiff, modifyDiff } from '../../../util/diff';
import styled from 'styled-components';
import { parse } from '../../../util/diff-parser';
import { Logger } from '../../../util/logger';

const StagingChunkHeader = styled.div`
    font-size: 90%;
    color: white;
    background-color: #505050;
    display: grid;
    grid-template-columns: 1fr fit-content(10rem) fit-content(10rem);
    grid-column-gap: 0.5rem;
`;

export const StagingDiff: React.FC<{
    diff: string;
    onAddDiff: (diff: string) => void;
    onDiscardDiff: (diff: string) => void;
    isIndex?: boolean;
}> = (props) => {
    const parsedDiff = React.useMemo(() => {
        return parse(props.diff, 125);
    }, [props.diff]);
    const { onAddDiff, onDiscardDiff } = props;
    const isIndex = props.isIndex;

    const maxLineNumberLength =
        Math.floor(
            Math.log10(
                (parsedDiff && parsedDiff.length > 0 && maxLineNumber(parsedDiff[0].chunks)) || 0
            )
        ) + 1;

    function StagingChunk(props: ChunkRendererProps) {
        const isPartial = props.chunk.lines[props.chunk.lines.length - 1]?.type === 'timeout';
        return (
            <div>
                <StagingChunkHeader>
                    {props.chunk.header}
                    {!isPartial && (
                        <button
                            onClick={() =>
                                onAddDiff(
                                    serializeDiff(
                                        parsedDiff[0].header,
                                        modifyDiff(parsedDiff[0], {
                                            first: {
                                                chunkIndex: props.chunkIndex,
                                                lineIndex: 0,
                                            },
                                            last: {
                                                chunkIndex: props.chunkIndex,
                                                lineIndex: props.chunk.lines.length - 1,
                                            },
                                        })
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
                                        parsedDiff[0].header,
                                        modifyDiff(parsedDiff[0], {
                                            first: {
                                                chunkIndex: props.chunkIndex,
                                                lineIndex: 0,
                                            },
                                            last: {
                                                chunkIndex: props.chunkIndex,
                                                lineIndex: props.chunk.lines.length - 1,
                                            },
                                        })
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
                    />
                ))}
            </div>
        );
    }

    return parsedDiff && parsedDiff.length > 0 ? (
        <DiffViewer
            file={parsedDiff[0]}
            chunk={StagingChunk}
            onContextMenu={(ev, currentSelection) => {
                if (currentSelection) {
                    const newDiff = serializeDiff(
                        parsedDiff[0].header,
                        modifyDiff(parsedDiff[0], normalize(currentSelection))
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
