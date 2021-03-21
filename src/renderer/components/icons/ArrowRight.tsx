import * as React from 'react';

import '../../../style/app.css';
import { useTheme } from 'styled-components';

export function ArrowRight() {
    const theme = useTheme();
    return (
        <svg viewBox="0 0 24 24" width="1rem" height="1rem">
            <path d="M 7,4 V 20 L 17,12 8,4 z" fill={theme.colors.foreground} />
        </svg>
    );
}
