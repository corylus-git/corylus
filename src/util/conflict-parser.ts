/**
 * Interface representing the contents of a conflicted file
 */
export interface IConflictedFile {
    /**
     * The path to the file in conflict
     */
    path: string;

    /**
     * The lines in the conflicted file
     */
    lines: readonly IConflictLine[];
}

/**
 * interface representing one line in a conflicted merge
 */
export interface IConflictLine {
    /**
     * Our content of said line
     */
    readonly ours?: string;
    /**
     * Their content of said line. undefined if isConflict === false
     */
    readonly theirs?: string;
    /**
     * Indicator for whether the line actually is conflicted. In that case, the
     * two fields above may differ
     */
    readonly isConflict: boolean;
}

export function parseConflictFile(input: string): readonly IConflictLine[] {
    const lines = input.split(/\n/);

    const conflictLines: IConflictLine[] = [];
    let currentMode: 'same' | 'ours' | 'theirs' = 'same'; // the current mode while tracking through the file and its conflict markers
    let conflictedLines: IConflictLine[] = []; // array for tracking line values in a conflict to be able to set ours and theirs next to each other
    let currentConflictLineCounter = 0;
    for (const line of lines) {
        if (line.startsWith('<<<<<<<') && currentMode === 'same') {
            currentMode = 'ours';
        } else if (line.startsWith('=======') && currentMode === 'ours') {
            currentMode = 'theirs';
        } else if (line.startsWith('>>>>>>>') && currentMode === 'theirs') {
            currentMode = 'same';
            conflictLines.push(...conflictedLines);
            conflictedLines = [];
            currentConflictLineCounter = 0;
        } else {
            if (currentMode === 'same') {
                conflictLines.push({ ours: line, isConflict: false });
            }
            if (currentMode === 'ours') {
                conflictedLines.push({ ours: line, isConflict: true });
            }
            if (currentMode === 'theirs') {
                if (currentConflictLineCounter >= conflictedLines.length) {
                    conflictedLines.push({ theirs: line, isConflict: true });
                } else {
                    conflictedLines[currentConflictLineCounter] = {
                        ...conflictedLines[currentConflictLineCounter],
                        theirs: line
                    };
                }
                currentConflictLineCounter++;
            }
        }
    }
    return conflictLines;
}
