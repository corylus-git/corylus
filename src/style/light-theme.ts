import { DefaultTheme } from 'styled-components';

export const lightTheme: DefaultTheme = {
    name: 'Light Green',
    colors: {
        background: '#FFFFFF',
        foreground: '#002000',
        highlight: '#D0E0D0',
        selected: '#A0C0A0',
        border: '#304030',
        input: '#F0F0F0',
        conflict: '#ffcc00',
        conflictText: '#101010',
        code: '#F0F0F0',
        notify: '#F07000',
        diff: {
            default: {
                inserted: '#B0F0B0',
                deleted: '#F0B0B0',
                context: '#E0E0E0',
            },
            selected: {
                inserted: '#407050',
                deleted: '#904050',
                context: '#404040',
            },
            conflict: {
                ours: '#303090',
                theirs: '#909030',
                conflict: '#FF0000',
            },
        },
        graph: {
            colors: ['#FF8080', '#80FF80', '#8080FF', '#FFFF80', '#FF80FF'],
            borders: ['#A04040', '#40A040', '#4040A0', '#A0A040', '#A040A0'],
        },
    },
};
