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

type ThemeActions = {
    switchTheme: (name: string) => void;
};

type ThemeStore = {
    current: Theme;
};

export const allThemes = [
    lightTheme,
    darkTheme,
    lightBlueTheme,
    darkBlueTheme,
    lightRedTheme,
    darkRedTheme,
];

export const themeStore = create<ThemeStore & ThemeActions>(
    log((set) => ({
        current: darkTheme,
        switchTheme: (name: string): void => {
            const newTheme = allThemes.find((t) => t.name === name) ?? darkTheme;
            Logger().debug('themeStore', 'Switching theme', { name, newTheme });
            set((state) => {
                state.current = newTheme;
                return state;
            });
        },
    }))
);

export const useTheme = createHook(themeStore);
