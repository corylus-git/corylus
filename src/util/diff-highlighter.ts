import { DiffChunk, DiffLine } from './diff-parser';
import diff from 'fast-diff';

export interface Highlights extends Omit<DiffLine, 'content'> {
    spans: { content: string; highlight: boolean }[];
}

export function calculateHighlightAreas(chunk: DiffChunk): Highlights[] {
    let ret: Highlights[] = [];
    let currentInserts: DiffLine[] = [];
    let currentDeletes: DiffLine[] = [];
    for (const line of chunk.lines) {
        switch (line.type) {
            case 'context':
            case 'pseudo-context':
            case 'timeout':
                if (currentInserts.length !== 0 || currentDeletes.length !== 0) {
                    ret = [...ret, ...getHighlights(currentInserts, currentDeletes)];
                    currentInserts = [];
                    currentDeletes = [];
                }
                ret = [...ret, { ...line, spans: [{ content: line.content, highlight: false }] }];
                break;
            case 'insert':
                currentInserts = [...currentInserts, line];
                break;
            case 'delete':
                currentDeletes = [...currentDeletes, line];
        }
    }
    if (currentInserts.length !== 0 || currentDeletes.length !== 0) {
        ret = [...ret, ...getHighlights(currentInserts, currentDeletes)];
        currentInserts = [];
        currentDeletes = [];
    }
    return ret;
}

function getHighlights(inserts: DiffLine[], deletes: DiffLine[]): Highlights[] {
    const insertHighlights: Highlights[] = [];
    const deleteHighlights: Highlights[] = [];
    const maxLength = Math.max(inserts.length, deletes.length);
    for (let i = 0; i < maxLength; i++) {
        // at the moment we consider adjecent lines of insert/delete blocks in side-by-side view as
        //  old->new pairs. Optimal alignment of the lines to minimizes edits may come later
        const d = diff(deletes[i]?.content ?? '', inserts[i]?.content ?? '');
        if (i < inserts.length) {
            // this diff applies to the insert side
            insertHighlights.push({
                type: 'insert',
                spans: d
                    .filter((edit) => edit[0] !== diff.DELETE)
                    .map((edit) => ({
                        content: edit[1],
                        highlight: edit[0] === diff.INSERT,
                    })),
            });
        }
        if (i < deletes.length) {
            // this diff applies to the delete side
            deleteHighlights.push({
                type: 'delete',
                spans: d
                    .filter((edit) => edit[0] !== diff.INSERT)
                    .map((edit) => ({
                        content: edit[1],
                        highlight: edit[0] === diff.DELETE,
                    })),
            });
        }
    }

    return deleteHighlights.concat(insertHighlights);
}
