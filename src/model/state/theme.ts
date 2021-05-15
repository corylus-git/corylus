import { log } from './log';
import createHook from 'zustand';
import create from 'zustand/vanilla';
import { Theme } from '../../style/theme';
import { darkTheme } from '../../style/dark-theme';
import { lightTheme } from '../../style/light-theme';
import { Logger } from '../../util/logger';

type ThemeActions = {
    switchTheme: (name: string) => void;
};

type ThemeStore = {
    current: Theme;
};

export const allThemes = [lightTheme, darkTheme];

export const themeStore = create<ThemeStore & ThemeActions>(
    log((set) => ({
        current: darkTheme,
        switchTheme: (name: string): void => {
            const newTheme = allThemes.find((t) => t.name === name) ?? darkTheme;
            Logger().debug('themeStore', 'Switching theme', { name, newTheme });
            set((state) => {
                state.current = newTheme;
            });
        },
    }))
);

export const useTheme = createHook(themeStore);
