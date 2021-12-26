import { DiffChunk, DiffLine } from './diff-parser';
import { diff_core } from 'fast-myers-diff';

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
        const d = tokenDiff(deletes[i]?.content ?? '', inserts[i]?.content ?? '');
        if (i < inserts.length) {
            // this diff applies to the insert side
            insertHighlights.push({
                type: 'insert',
                spans: d
                    .filter((edit) => edit.op !== 'delete')
                    .map((edit) => ({
                        content: edit.value,
                        highlight: edit.op === 'insert',
                    })),
            });
        }
        if (i < deletes.length) {
            // this diff applies to the delete side
            deleteHighlights.push({
                type: 'delete',
                spans: d
                    .filter((edit) => edit.op !== 'insert')
                    .map((edit) => ({
                        content: edit.value,
                        highlight: edit.op === 'delete',
                    })),
            });
        }
    }

    return deleteHighlights.concat(insertHighlights);
}

type Diff = {
    op: 'insert' | 'delete' | 'equal';
    value: string;
};

function tokenDiff(oldStr: string, newStr: string): Diff[] {
    const oldToken = tokenize(oldStr);
    const newToken = tokenize(newStr);

    const diffs = diff_core(
        0,
        oldToken.length,
        0,
        newToken.length,
        (i, j) => oldToken[i] === newToken[j]
    );

    let ret: Diff[] = [];
    let lastIdx = 0;
    for (const [sx, ex, sy, ey] of diffs) {
        if (sx > lastIdx) {
            // we have an equal part before the diff
            ret = [
                ...ret,
                ...oldToken.slice(lastIdx, sx).map(
                    (token) =>
                        ({
                            op: 'equal',
                            value: token,
                        } as Diff)
                ),
            ];
            lastIdx = ex;
        }
        oldToken.slice(sx, ex).forEach((token) => {
            ret.push({
                op: 'delete',
                value: token,
            });
        });
        newToken.slice(sy, ey).forEach((token) => {
            ret.push({
                op: 'insert',
                value: token,
            });
        });
    }

    if (lastIdx < oldToken.length) {
        // another run of equal parts after the last diff
        ret = [
            ...ret,
            ...oldToken.slice(lastIdx).map(
                (token) =>
                    ({
                        op: 'equal',
                        value: token,
                    } as Diff)
            ),
        ];
    }

    return ret;
}

const word = /^[\w\d-_]+/;
const whitespace = /^\s+/;
const any = /^./;

/**
 * Split a string into its constituent tokens
 *
 * @param str The string to split
 * @param tokens A set of regex each representing a specific token to match/extract. Tokens are matched in
 *  order the regex appear in the parameter list. Therefore, if token regex overlap (which they shouldn't),
 *  the earlier ones match first. The last match should always be a catch-all operator
 * @returns The input string split apart into its constituent tokens.
 */
function tokenize(str: string): string[] {
    let currentIndex = 0;
    const ret: string[] = [];
    while (currentIndex < str.length) {
        const tmpStr = str.slice(currentIndex);
        for (const r of [word, whitespace, any]) {
            const match = r.exec(tmpStr);
            if (match) {
                ret.push(match[0]);
                currentIndex += match[0].length;
                break;
            }
        }
    }
    return ret;
}
