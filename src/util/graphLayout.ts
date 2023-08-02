import { Commit } from '../model/stateObjects';
import { Rail } from '../components/History/graph/RailLine';

export interface LayoutListEntry {
    rail: number;
    hasParentLine: boolean;
    hasChildLine: boolean;
    outgoing: number[];
    incoming: number[];
    rails: readonly Rail[];
    commit: Commit;
}

export type GraphLayoutData = {
    lines: readonly LayoutListEntry[];
    rails: readonly Rail[];
};
