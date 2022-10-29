import React from 'react';
import styled, { useTheme } from 'styled-components';

export const lineWidth = 2;
export const nodeRadius = 5.5;

export type Rail = string | null;

/**
 * Helper function to calculate the middle x coordinate of a rail
 * @param railIndex The index of the rail
 */
export function x(railIndex: number): number {
    return railIndex * 11 + 6;
}
export const BranchMergeLine: React.FC<{
    sourceRail: number;
    targetRail: number;
    isBranch?: boolean;
}> = (props) => {
    const theme = useTheme();
    const start = {
        x: x(props.sourceRail),
        y: !props.isBranch || props.sourceRail < props.targetRail ? 50 : 0,
    };
    const end = { x: x(props.targetRail), y: 25 };
    return (
        <path
            d={`M ${start.x},${start.y} Q ${start.x},${end.y} ${end.x},${end.y}`}
            stroke={`hsl(${props.sourceRail * 100}, 100%, calc(50% - (var(--lightness) - 50%) / 2)`}
            strokeWidth={lineWidth}
            fill="transparent"
        />
    );
};
export const RailLine = styled.div<{
    size: number;
}>`
    width: ${(props) => props.size}rem;
    height: 3rem;
    flex-shrink: 0;
    flex-grow: 0;
    margin: 0;
    overflow: hidden;
`;
