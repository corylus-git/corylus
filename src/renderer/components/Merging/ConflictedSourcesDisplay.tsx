import React from 'react';
import styled from 'styled-components';
import '../../../style/fira_code.css';
import { Hoverable } from '../StyleBase';
import { IConflictBlock } from './util/blocks';
import MonacoEditor from 'react-monaco-editor';
import * as monaco from 'monaco-editor';
import ReactResizeDetector from 'react-resize-detector';
import { Logger } from '../../../util/logger';
import { IConflictLine } from '../../../util/conflict-parser';
import { attachScrollHandlers } from '../util/scrollSync';

const ConflictView = styled.div`
    min-width: 100%;
    max-width: 100%;
    width: 0;
    display: grid;
    grid-template-columns: 1fr 2rem 2rem 1fr;
    grid-template-rows: fit-content(3rem) 1fr;
    padding: 0;
    height: 100%;
    overflow: hidden;

    .emptyLine {
        border-top: 0.1rem solid var(--background);
        border-bottom: 0.1rem solid var(--background);
        height: 1.2rem;
        box-sizing: border-box;
        background: repeating-linear-gradient(
            45deg,
            var(--highlight) 0px,
            var(--highlight) 1px,
            var(--background) 2px,
            var(--background) 7px
        );
    }
`;

const SideSelector = styled.button<{ selected?: boolean; lines: number; height: number }>`
    ${Hoverable}
    width: 2rem;
    padding: 0;
    border: 1px solid var(--border);
    text-align: center;
    background-color: ${(props) => (props.selected ? 'var(--foreground)' : 'var(--background)')};
    color: ${(props) => (props.selected ? 'var(--background)' : 'var(--foreground)')};
    font-size: 80%;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    display: block;
    height: ${(props) => props.height * 19}px;
`;

const CodeHeader = styled.h1`
    font-size: 1.3rem;
    text-align: center;
    border-bottom: 1px var(--border);
    position: sticky;
`;

const AuxillaryColumn = styled.div`
    height: 1fr;
    overflow: hidden;
`;

const AuxillaryLeftColumn = styled(AuxillaryColumn)`
    border-left: 1px dotted var(--border);
`;
const AuxillaryRightColumn = styled(AuxillaryColumn)`
    border-right: 1px dotted var(--border);
`;

function mapLines(
    lines: readonly IConflictLine[],
    accessor: (l: IConflictLine) => string | undefined
): string {
    return lines
        .map((l) => {
            const value = accessor(l);
            if (l.isConflict) {
                return value ?? '';
            }
            return l.ours;
        })
        .join('\n');
}

function calculateDecorations(
    lines: readonly IConflictLine[],
    accessor: (l: IConflictLine) => string | undefined,
    className: string
) {
    return lines.reduce((existing, l, index) => {
        if (l.isConflict) {
            const value = accessor(l);
            const c = value !== undefined ? className : 'emptyLine';
            return existing.concat({
                range: new monaco.Range(index + 1, 1, index + 1, 1),
                options: {
                    isWholeLine: true,
                    className: c,
                },
            });
        }
        return existing;
    }, [] as monaco.editor.IModelDeltaDecoration[]);
}

export interface ConflictedSourcesDisplayProps {
    blocks: readonly IConflictBlock[];
    onToggleBlock: (side: 'ours' | 'theirs', index: number) => void;
    onScroll?: (top: number) => void;
    type: string;
}

export const ConflictedSourcesDisplay: React.FC<ConflictedSourcesDisplayProps> = (props) => {
    const oursRef = React.useRef<monaco.editor.ICodeEditor>();
    const theirsRef = React.useRef<monaco.editor.ICodeEditor>();
    const oursSelector = React.createRef<HTMLDivElement>();
    const theirsSelector = React.createRef<HTMLDivElement>();
    const lines = props.blocks.flatMap((b) => b.lines);

    return (
        <ConflictView>
            <CodeHeader>Ours (A)</CodeHeader>
            <div></div>
            <div></div>
            <CodeHeader>Theirs (B)</CodeHeader>
            <MonacoEditor
                language={props.type}
                theme="vs-dark"
                value={mapLines(lines, (l) => l.ours)}
                options={{
                    automaticLayout: true,
                    codeLens: false,
                    contextmenu: false,
                    links: true,
                    quickSuggestions: false,
                    showUnused: false,
                    glyphMargin: false,
                    minimap: {
                        enabled: false,
                    },
                    folding: false,
                    scrollBeyondLastLine: false,
                    readOnly: true,
                }}
                editorDidMount={(editor) => {
                    oursRef.current = editor;
                    attachScrollHandlers(
                        [oursRef.current, theirsRef.current],
                        [oursSelector.current, theirsSelector.current],
                        props.onScroll
                    );
                    editor.deltaDecorations(
                        [],
                        calculateDecorations(lines, (l) => l.ours, 'diff-conflict-ours')
                    );
                }}
            />
            <AuxillaryLeftColumn ref={oursSelector}>
                {props.blocks.map((block, index) => {
                    const [ourLines, theirLines] = block.lines.reduce(
                        ([ours, theirs], l) => [
                            l.ours !== undefined ? ours + 1 : ours,
                            l.theirs !== undefined ? theirs + 1 : theirs,
                        ],
                        [0, 0]
                    );
                    if (block.isConflict) {
                        return (
                            <SideSelector
                                key={index}
                                lines={ourLines}
                                height={Math.max(ourLines, theirLines)}
                                onClick={() => props.onToggleBlock('ours', index)}
                                selected={block.oursSelected}>
                                ⬅&nbsp;A
                            </SideSelector>
                        );
                    }
                    return (
                        <div
                            key={index}
                            style={{
                                width: '2rem',
                                height: `${19 * block.lines.length}px`,
                            }}></div>
                    );
                })}
            </AuxillaryLeftColumn>
            <AuxillaryRightColumn ref={theirsSelector}>
                {props.blocks.map((block, index) => {
                    const [ourLines, theirLines] = block.lines.reduce(
                        ([ours, theirs], l) => [
                            l.ours !== undefined ? ours + 1 : ours,
                            l.theirs !== undefined ? theirs + 1 : theirs,
                        ],
                        [0, 0]
                    );
                    if (block.isConflict) {
                        return (
                            <SideSelector
                                key={index}
                                lines={theirLines}
                                height={Math.max(ourLines, theirLines)}
                                onClick={() => props.onToggleBlock('theirs', index)}
                                selected={block.theirsSelected}>
                                B&nbsp;⮕
                            </SideSelector>
                        );
                    }
                    return (
                        <div
                            key={index}
                            style={{
                                width: '2rem',
                                height: `${19 * block.lines.length}px`,
                            }}></div>
                    );
                })}
            </AuxillaryRightColumn>
            <MonacoEditor
                language={props.type}
                theme="vs-dark"
                value={mapLines(lines, (l) => l.theirs)}
                options={{
                    automaticLayout: true,
                    codeLens: false,
                    contextmenu: false,
                    links: true,
                    quickSuggestions: false,
                    showUnused: false,
                    glyphMargin: false,
                    minimap: {
                        enabled: false,
                    },
                    folding: false,
                    scrollBeyondLastLine: false,
                    readOnly: true,
                }}
                editorDidMount={(editor) => {
                    theirsRef.current = editor;
                    attachScrollHandlers(
                        [oursRef.current, theirsRef.current],
                        [oursSelector.current, theirsSelector.current],
                        props.onScroll
                    );
                    editor.deltaDecorations(
                        [],
                        calculateDecorations(lines, (l) => l.theirs, 'diff-conflict-theirs')
                    );
                }}
            />
            <ReactResizeDetector
                handleWidth
                handleHeight
                onResize={() => {
                    oursRef.current && oursRef.current.layout();
                    theirsRef.current && theirsRef.current.layout();
                }}
            />
        </ConflictView>
    );
};
