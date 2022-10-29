import { IConflictLine } from '../../../util/conflict-parser';

export interface IConflictBlock {
    offset: number;
    isConflict: boolean;
    lines: readonly IConflictLine[];
    oursSelected: boolean;
    theirsSelected: boolean;
}

export function calculateBlocks(lines: readonly IConflictLine[]): readonly IConflictBlock[] {
    const blocks = lines.reduce((blocks, line, index) => {
        if (blocks.length === 0 || blocks[blocks.length - 1].isConflict !== line.isConflict) {
            return blocks.concat({
                offset: index,
                isConflict: line.isConflict,
                lines: [line],
                oursSelected: false,
                theirsSelected: false
            });
        }
        return blocks.slice(0, blocks.length - 1).concat({
            offset: blocks[blocks.length - 1].offset,
            isConflict: line.isConflict,
            lines: blocks[blocks.length - 1].lines.concat(line),
            oursSelected: false,
            theirsSelected: false
        });
    }, [] as readonly IConflictBlock[]);
    return blocks;
}
