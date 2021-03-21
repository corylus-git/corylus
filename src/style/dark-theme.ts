import { DefaultTheme } from 'styled-components';

export const darkTheme: DefaultTheme = {
    name: 'Dark Green',
    colors: {
        background: '#202020',
        foreground: '#C0FFC0',
        highlight: '#304030',
        selected: '#708070',
        border: '#708070',
        input: '#101010',
        conflict: '#ffcc00',
        conflictText: '#101010',
        code: '#303030',
        notify: '#C0FF50',
        diff: {
            default: {
                inserted: '#204020',
                deleted: '#603030',
                context: '#101010',
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
            colors: ['#A04040', '#40A040', '#4040A0', '#A0A040', '#A040A0'],
            borders: ['#FF8080', '#80FF80', '#8080FF', '#FFFF80', '#FF80FF'],
        },
    },
};
