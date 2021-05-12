import { Commit } from '../stateObjects';
import createHook from 'zustand';
import create from 'zustand/vanilla';
import { calculateGraphLayout, calculateSubLayout, GraphLayoutData } from '../../util/graphLayout';

export type GraphActions = {
    calculateGraph: (orderedHistory: readonly Commit[]) => void;
    addAdditionalEntries: (entries: readonly Commit[]) => void;
    reset: () => void;
};

export const graph = create<GraphLayoutData & GraphActions>((set, _) => ({
    lines: [],
    rails: [],
    calculateGraph: (orderedHistory: readonly Commit[]): void => {
        const { rails, lines } = calculateGraphLayout(orderedHistory);

        set((state) => {
            state.rails = rails;
            state.lines = lines;
        });
    },
    addAdditionalEntries: (entries: readonly Commit[]): void => {
        set((state) => {
            const subgraph = calculateSubLayout(state.rails, entries);
            state.rails = subgraph.rails;
            state.lines = [...state.lines, ...subgraph.lines];
        });
    },
    reset: (): void => {
        set((state) => {
            state.lines = [];
            state.rails = [];
        });
    },
}));

export const useGraph = createHook(graph);
