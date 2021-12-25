import MonacoEditor from 'react-monaco-editor';
import * as monaco from 'monaco-editor';
import { IConflictBlock } from './util/blocks';
import styled, { useTheme, DefaultTheme } from 'styled-components';
import React from 'react';
import ReactResizeDetector from 'react-resize-detector';

interface IMergedLine {
    source: 'ours' | 'theirs' | 'both' | 'conflict';
    content: string;
}

monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
});
monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
});

function calculateOutput(blocks: readonly IConflictBlock[]): readonly IMergedLine[] {
    return blocks.reduce((outputLines, block) => {
        if (!block.isConflict) {
            return outputLines.concat(
                block.lines.map((l) => ({ source: 'both', content: l.ours! }))
            );
        }
        if (block.oursSelected || block.theirsSelected) {
            return outputLines
                .concat(
                    block.oursSelected
                        ? block.lines
                              .filter((l) => l.ours !== undefined)
                              .map((l) => ({ source: 'ours', content: l.ours! }))
                        : []
                )
                .concat(
                    block.theirsSelected
                        ? block.lines
                              .filter((l) => l.theirs !== undefined)
                              .map((l) => ({ source: 'theirs', content: l.theirs! }))
                        : []
                );
        }
        return outputLines.concat([{ source: 'conflict', content: '<?>' }]);
    }, [] as IMergedLine[]);
}

const ConflictContainer = styled.div`
    .glyph-conflict {
        background-color: rgba(var(--diff-conflict-value), 64);
        ::before {
            content: '🗲';
        }
    }
    .line-conflict {
        background-color: rgba(var(--diff-conflict-value), 64);
    }
    .glyph-ours {
        ::before {
            content: 'A';
        }
    }
    .glyph-theirs {
        ::before {
            content: 'B';
        }
    }
`;

export interface IScroller {
    scrollTo(top: number): void;
}

export interface IEditorContainerProps {
    blocks: readonly IConflictBlock[] | undefined;
    onChange: (code: string) => void;
    editorMounted?: (editor: monaco.editor.ICodeEditor) => void;
}

function calculateDecorations(
    editedCode: string,
    editor: monaco.editor.IEditor | undefined,
    code: readonly IMergedLine[],
    theme: DefaultTheme,
    existingGlyphs: React.MutableRefObject<string[]>
) {
    if (editedCode && editor) {
        const decorations = code.reduce((existing, l, index) => {
            if (l.source === 'both') {
                return existing;
            }
            return existing.concat({
                range: new monaco.Range(index + 1, 1, index + 1, 1),
                options: {
                    isWholeLine: true,
                    className: `line-${l.source}`,
                    glyphMarginClassName: `glyph-${l.source} diff-conflict-${l.source}`,
                    overviewRuler: {
                        color:
                            l.source === 'conflict'
                                ? 'rgb(var(--diff-conflict-value))'
                                : l.source === 'ours'
                                ? 'rgb(var(--diff-conflict-ours-value))'
                                : 'rgb(var(--diff-conflict-theirs-value))',
                        position: monaco.editor.OverviewRulerLane.Full,
                    },
                },
            });
        }, [] as monaco.editor.IModelDeltaDecoration[]);
        existingGlyphs.current = (editor as monaco.editor.ICodeEditor)?.deltaDecorations(
            existingGlyphs.current,
            decorations
        );
    }
}

export const EditorContainer: React.FC<IEditorContainerProps> = (props) => {
    const [code, setCode] = React.useState<readonly IMergedLine[]>([]);
    const [editedCode, setEditedCode] = React.useState('');
    React.useEffect(() => {
        props.blocks && setCode(calculateOutput(props.blocks));
    }, [props.blocks]);
    React.useEffect(() => {
        code && setEditedCode(code.map((l) => l.content).join('\n'));
    }, [code]);
    const existingGlyphs = React.useRef<string[]>([]);
    const editorRef = React.useRef<monaco.editor.ICodeEditor>();
    const theme = useTheme();
    React.useLayoutEffect(() => {
        calculateDecorations(editedCode, editorRef.current, code, theme, existingGlyphs);
        props.onChange(editedCode);
    }, [editedCode]);
    return (
        <ConflictContainer
            style={{
                minHeight: '100%',
                maxHeight: '100%',
                minWidth: '100%',
                maxWidth: '100%',
                width: 0,
                height: 0,
                overflow: 'hidden',
            }}>
            <MonacoEditor
                language="typescript"
                theme="vs-dark"
                value={editedCode}
                options={{
                    automaticLayout: true,
                    codeLens: false,
                    contextmenu: false,
                    links: true,
                    quickSuggestions: false,
                    showUnused: false,
                    glyphMargin: true,
                    minimap: {
                        enabled: false,
                    },
                    scrollBeyondLastLine: false,
                    readOnly: true,
                }}
                editorDidMount={(editor) => {
                    editorRef.current = editor;
                    props.editorMounted?.(editor);
                }}
            />
            <ReactResizeDetector
                handleWidth
                handleHeight
                onResize={() => {
                    editorRef.current && editorRef.current.layout();
                }}
            />
        </ConflictContainer>
    );
};
