import { log } from './log';
import createHook from 'zustand';
import create from 'zustand/vanilla';
import { Theme } from '../../style/theme';
import { darkTheme } from '../../style/dark-theme';
import { lightTheme } from '../../style/light-theme';
import { darkBlueTheme } from '../../style/dark-blue-theme';
import { lightBlueTheme } from '../../style/light-blue-theme';
import { darkRedTheme } from '../../style/dark-red-theme';
import { lightRedTheme } from '../../style/light-red-theme';
import { Logger } from '../../util/logger';

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
