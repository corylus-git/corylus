import { Logger } from './logger';

/**
 * interface representing the diff of a single file
 */
export interface FileDiff {
    /**
     * The diff header for this file
     */
    header: string[];

    /**
     * The old name of the file
     */
    oldName: string;
    /**
     * The new name of the file. Might be identical to the old name
     */
    newName: string;

    /**
     * The chunks contained in this file
     */
    chunks: readonly DiffChunk[];
}

/**
 * interface representing a chunk in a diff
 */
export interface DiffChunk {
    /**
     * The chunk header as present in the input
     */
    header: string;

    /**
     * The lines, as present in the input
     */
    lines: readonly DiffLine[];
}

/**
 * An individual line in the diff
 */
export interface DiffLine {
    /**
     * The type of line this represents: an inserted line, a deleted one, an unmodified context line or a piece of pseudo-context,
     * i.e. a line that's just in the diff line "\ No newline at end of file"
     */
    type: 'insert' | 'delete' | 'context' | 'pseudo-context' | 'timeout';

    /**
     * The content of the line _including_ the type marker at the start
     */
    content: string;

    /**
     * The number of this line in the old version of the file
     */
    oldNumber?: number;

    /**
     * The number of this line in the new version of the file
     */
    newNumber?: number;
}

/**
 * Parse a diff into a structured object
 *
 * @param diff The diff string to parse
 * @param maxDurationMS If defined, gives a maximum number of milliseconds the
 *  parser may spend on parsing the diff. If the limit is exceeded, the parser bails
 *  with a partial result.
 */
export function parse(diff: string, maxDurationMS?: number): readonly FileDiff[] {
    // split the diff into individual lines
    const lines = diff?.split(/\n/) ?? [];

    const files: FileDiff[] = [];
    let remainingLines: string[] = lines;
    const startTime = Date.now();
    while (
        (!maxDurationMS || Date.now() < startTime + maxDurationMS) &&
        remainingLines.length > 0 &&
        remainingLines[0].startsWith('diff ')
    ) {
        const result = parseFile(remainingLines, startTime, maxDurationMS);
        files.push(result.file);
        remainingLines = result.remainingLines;
    }

    return files;
}

function parseFile(
    lines: string[],
    startTime: number,
    maxDurationMS?: number
): { remainingLines: string[]; file: FileDiff } {
    try {
        let headerLength = 0;
        while (headerLength < lines.length && !lines[headerLength].startsWith('---')) {
            headerLength++;
        }
        let remainingLines = lines.slice(headerLength + 2);
        const oldFile = lines[headerLength]?.match(/^---\s+([a-z]+\/)(?<filename>.+)$/);
        const newFile = lines[headerLength + 1]?.match(/^\+\+\+\s+([a-z]+\/)(?<filename>.+)$/);
        const chunks: DiffChunk[] = [];
        while (
            (!maxDurationMS || Date.now() < startTime + maxDurationMS) &&
            remainingLines.length > 0 &&
            remainingLines[0].startsWith('@@')
        ) {
            const result = parseChunk(remainingLines, startTime, maxDurationMS);
            remainingLines = result.remainingLines;
            chunks.push(result.chunk);
        }
        return {
            remainingLines: remainingLines,
            file: {
                header: lines.slice(0, headerLength + 2),
                oldName: oldFile?.groups?.filename ?? '',
                newName: newFile?.groups?.filename ?? '',
                chunks: chunks,
            },
        };
    } catch (e) {
        Logger().error('parseFile', 'Could not parse diff file entry', { error: e });
        throw e;
    }
}

function parseChunk(
    lines: string[],
    startTime: number,
    maxDurationMS?: number
): { remainingLines: string[]; chunk: DiffChunk } {
    const header = lines[0].match(
        /^@@(@*)\s+-(?<oldstartline>\d+)(,(?<oldlength>\d+)){0,1}\s+(-\d+,\d+\s+)*\+(?<newstartline>\d+)(,(?<newlength>\d+)){0,1}\s+@@(@*)(?<rest>.*)$/
    );
    if (!header) {
        throw new Error(`Expected new block start, got ${lines[0]}`);
    }
    let counter = 1;
    while (
        (!maxDurationMS || Date.now() < startTime + maxDurationMS) &&
        lines[counter] &&
        !lines[counter].startsWith('@@') &&
        !lines[counter].startsWith('diff ') &&
        counter < lines.length
    ) {
        counter++;
    }
    let existing = {
        oldLine: parseInt(header?.groups?.oldstartline ?? '0'),
        newLine: parseInt(header?.groups?.newstartline ?? '0'),
        lines: [] as DiffLine[],
    };
    for (const line of lines.slice(1, counter)) {
        if (maxDurationMS && Date.now() > startTime + maxDurationMS) {
            existing.lines = [
                ...existing.lines,
                {
                    type: 'timeout',
                    content: 'Parse timeout exceeded. Diff too large.',
                },
            ];
            break;
        }
        const parsedLine = parseLine(line);
        const isOld = parsedLine.type === 'delete' || parsedLine.type === 'context'; // deleted and context lines were in the old state
        const oldLine = existing.oldLine + (isOld ? 1 : 0);
        const isNew = parsedLine.type === 'insert' || parsedLine.type === 'context'; // inserted and context lines are in the new state
        const newLine = existing.newLine + (isNew ? 1 : 0);
        existing = {
            oldLine: oldLine,
            newLine: newLine,
            lines: existing.lines.concat({
                ...parsedLine,
                oldNumber: isOld ? oldLine - 1 : undefined,
                newNumber: isNew ? newLine - 1 : undefined,
            }),
        };
    }
    return {
        remainingLines: lines.slice(counter),
        chunk: {
            header: lines[0],
            lines: existing.lines,
        },
    };
}

function parseLine(line: string): DiffLine {
    return {
        type: getLineType(line[0]),
        content: line,
    };
}

function getLineType(marker: string): DiffLine['type'] {
    switch (marker) {
        case '+':
            return 'insert';
        case '-':
            return 'delete';
        case ' ':
            return 'context';
        default:
            return 'pseudo-context';
    }
}
