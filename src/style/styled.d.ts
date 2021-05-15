// import original module declarations
import 'styled-components';

// and extend them!
declare module 'styled-components' {
    export interface DefaultTheme {
        name: string;
        colors: {
            diff: {
                conflict: {
                    ours: string;
                    theirs: string;
                    conflict: string;
                };
            };
        };
    }
}
