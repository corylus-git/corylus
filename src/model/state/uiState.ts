import { log } from './log';
import createHook from 'zustand';
import create from 'zustand/vanilla';

type UiActions = {
    startProgress: (name: string) => void;
    stopProgress: (name: string) => void;
};

type UiStore = {
    inProgress: string[];
};

export const uiStore = create<UiStore & UiActions>(
    log((set) => ({
        inProgress: [],
        startProgress: (name: string): void => {
            set((state) => {
                state.inProgress = [...state.inProgress, name];
            });
        },
        stopProgress: (name: string): void => {
            set((state) => {
                state.inProgress = state.inProgress.filter((n) => n !== name);
            });
        },
    }))
);

export const useUiState = createHook(uiStore);

export const isInProgress = (name: string): boolean =>
    !!useUiState((state) => state.inProgress).find((n) => n === name);
