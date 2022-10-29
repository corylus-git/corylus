import { Commit } from '../model/stateObjects';
import { Rail } from '../components/History/RailLine';

export interface LayoutListEntry {
    rail: number;
    hasParent: boolean;
    hasChild: boolean;
    outgoing: number[];
    incoming: number[];
    rails: readonly Rail[];
    commit: Commit;
}

export type GraphLayoutData = {
    lines: readonly LayoutListEntry[];
    rails: readonly Rail[];
};
