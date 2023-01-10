import { SelectedLines } from '../components/Diff/DiffViewer';
import { FileDiff, DiffChunk, DiffLine } from './diff-parser';
import { Logger } from './logger';

interface ChunkHeader {
    oldstartline: number;
    newstartline: number;
    oldlength: number;
    newlength: number;
    description: string;
}

function parseHeader(header: string): ChunkHeader | undefined {
    const h = header.match(
        /^@@\s+-(?<oldstartline>\d+),(?<oldlength>\d+)\s+\+(?<newstartline>\d+),(?<newlength>\d+)\s+@@(?<rest>.*)$/
    );
    if (!h) {
        return undefined;
    }
    return {
        oldstartline: parseInt(h!.groups!.oldstartline),
        newstartline: parseInt(h!.groups!.newstartline),
        oldlength: parseInt(h!.groups!.oldlength),
        newlength: parseInt(h!.groups!.newlength),
        description: h!.groups!.rest,
    };
}

/**
 * Modify a diff by only taking a certain amount of lines from it, so that only those lines are applied
 * to the patched output. Used to implement partial addition in the index panel
 *
 * @param file The parsed diff to modify
 * @param lines The selection to use to modify the diff
 */
export function modifyDiff(file: FileDiff, lines: SelectedLines): FileDiff {
    Logger().silly('modifyDiff', 'Received diff for modification', {
        diff: file,
        selection: lines,
    });
    const modifiedChunks = [] as DiffChunk[];
    let accumulatedDelta = 0;
    for (let i = 0; i < file.chunks.length; i++) {
        if (i < lines.first.chunkIndex || i > lines.last.chunkIndex) {
            const headerInfo = parseHeader(file.chunks[i].header);
            accumulatedDelta += (headerInfo?.newlength ?? 0) - (headerInfo?.oldlength ?? 0); // if we apply the diffs as if those blocks never existed, we need to correct for the shifts those would have caused
            continue; // throw out all blocks fully outside the selection
        }
        if (i === lines.first.chunkIndex) {
            // only take lines in the selection
            const chunk: DiffChunk = { ...file.chunks[i] };
            chunk.lines = chunk.lines.reduce((newLines, l, index) => {
                if (l.type === 'pseudoContext') {
                    return newLines.concat(l); // pseudo-context lines must be left untouched
                }
                if (
                    index < lines.first.lineIndex ||
                    (i === lines.last.chunkIndex && index > lines.last.lineIndex)
                ) {
                    if (l.type !== 'insert') {
                        return newLines.concat({
                            ...l,
                            type: 'context',
                            content: l.content,
                        } as DiffLine);
                    }
                    Logger().silly('modifyDiff', 'Leaving insert outside the collection', {
                        line: l,
                        index: index,
                    });
                    return newLines; // leave out inserts outside the selection
                }
                return newLines.concat(l);
            }, [] as DiffLine[]);
            const [correctBlock, lineDelta] = correctHeader(chunk, accumulatedDelta);
            accumulatedDelta += lineDelta;
            modifiedChunks.push(correctBlock);
            continue;
        }
        if (i === lines.last.chunkIndex) {
            // only take lines in the selection
            const chunk: DiffChunk = { ...file.chunks[i] };
            chunk.lines = chunk.lines.reduce((newLines, l, index) => {
                if (l.type === 'pseudoContext') {
                    return newLines.concat(l); // pseudo-context lines must be left untouched
                }
                if (index > lines.last.lineIndex) {
                    if (l.type !== 'insert') {
                        return newLines.concat({
                            ...l,
                            type: 'context',
                            content: l.content,
                        } as DiffLine);
                    }
                    Logger().silly('modifyDiff', 'Leaving insert outside the collection', {
                        line: l,
                        index: index,
                    });
                    return newLines; // leave out inserts outside the selection
                }
                return newLines.concat(l);
            }, [] as DiffLine[]);
            const [correctchunk, lineDelta] = correctHeader(chunk, accumulatedDelta);
            accumulatedDelta += lineDelta;
            modifiedChunks.push(correctchunk);
            continue;
        }
        modifiedChunks.push(file.chunks[i]);
    }
    const ret: FileDiff = {
        ...file,
        chunks: modifiedChunks,
    };
    Logger().silly('modifyDiff', 'Modified diff', { diff: ret });
    return ret;
}

function correctHeader(block: DiffChunk, newStartCorrection: number): [DiffChunk, number] {
    const header = parseHeader(block.header);
    if (!header) {
        Logger().error('diff', 'Could not correctly parse header', { header: block.header });
        return [block, 0]; // something went severely wrong. We're not touching the header
    }
    const added = block.lines.reduce((sum, l) => (l.type === 'insert' ? sum + 1 : sum), 0);
    const deleted = block.lines.reduce((sum, l) => (l.type === 'delete' ? sum + 1 : sum), 0);
    const context = block.lines.reduce((sum, l) => (l.type === 'context' ? sum + 1 : sum), 0);
    const oldlength = context + deleted;
    const newLength = context + added;
    return [
        {
            ...block,
            header: `@@ -${header!.oldstartline},${oldlength} +${
                header!.newstartline - newStartCorrection
            },${newLength} @@${header!.description}`,
        },
        header!.newlength - newLength,
    ]; // return the delta in length between the existing diff block and the fixed one -> used to fix the start positions of subsequent blocks
}

export function serializeDiff(diffHeader: string[], diff: FileDiff): string {
    console.log("Header:", diffHeader);
    const diffLines = diffHeader.filter(h => h.length != 0).concat(
        ...diff.chunks.map((b) => [b.header].concat(b.lines.map((l) => {
            l.content = l.content.replace('\n', '');
            switch (l.type)
            {
                case 'context':
                    return ` ${l.content}`;
                case 'delete':
                    return `-${l.content}`;
                case 'insert':
                    return `+${l.content}`;
                case 'pseudoContext':
                    return ` ${l.content}`;
                default:
                    return "";
            }
        })))
    );
    Logger().silly('modifyDiff', 'Serializing diff', { diff: diffLines });
    return `${diffLines.join('\n')}\n`;
}
