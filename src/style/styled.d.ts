// import original module declarations
import 'styled-components';

// and extend them!
declare module 'styled-components' {
    export interface DefaultTheme {
        name: string;
        colors: {
            background: string;
            foreground: string;
            highlight: string;
            selected: string;
            border: string;
            input: string;
            conflict: string;
            conflictText: string;
            code: string;
            notify: string;
            diff: {
                default: {
                    inserted: string;
                    deleted: string;
                    context: string;
                };
                selected: {
                    inserted: string;
                    deleted: string;
                    context: string;
                };
                conflict: {
                    ours: string;
                    theirs: string;
                    conflict: string;
                };
            };
            graph: {
                colors: string[];
                borders: string[];
            };
        };
    }
}
