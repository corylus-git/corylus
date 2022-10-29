import { Commit } from '../stateObjects';
import createHook from 'zustand';
import create from 'zustand/vanilla';
import { GraphLayoutData } from '../../util/graphLayout';
import { listen } from '@tauri-apps/api/event';

export type GraphActions = {
    setGraph: (graph: GraphLayoutData) => void;
    reset: () => void;
};

export const graph = create<GraphLayoutData & GraphActions>((set, _) => ({
    lines: [],
    rails: [],
    setGraph: (graph: GraphLayoutData): void => {
        set((_) => graph, true);
    },
    reset: (): void => {
        set((state) => {
            state.lines = [];
            state.rails = [];
            return state;
        });
    },
}));

export const useGraph = createHook(graph);

listen<GraphLayoutData>('graphChanged', ev => {
    console.log('Graph changed', ev.payload);
    graph.getState().setGraph(ev.payload);
});