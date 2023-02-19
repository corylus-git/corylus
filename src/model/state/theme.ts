import { darkTheme } from '../../style/dark-theme';
import { lightTheme } from '../../style/light-theme';
import { darkBlueTheme } from '../../style/dark-blue-theme';
import { lightBlueTheme } from '../../style/light-blue-theme';
import { darkRedTheme } from '../../style/dark-red-theme';
import { lightRedTheme } from '../../style/light-red-theme';
import { Logger } from '../../util/logger';
import { updateSettings, useSettings } from '../settings';

export const allThemes = [
    lightTheme,
    darkTheme,
    lightBlueTheme,
    darkBlueTheme,
    lightRedTheme,
    darkRedTheme,
];

export const useTheme = () => {
    const settings = useSettings();
    return {
        current: allThemes.find(t => t.name == settings.theme) ?? darkTheme,
        switchTheme: (name: string) => {
            Logger().debug('switchTheme', `Switching theme to ${name}`);
            updateSettings({
                ...settings,
                theme: name
            });
        }
    }
}
