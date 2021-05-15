import React from 'react';
import { x, BranchMergeLine, Rail, lineWidth, nodeRadius } from './RailLine';

export const GraphNode: React.FC<{
    rail: number;
    hasParent: boolean;
    hasChild: boolean;
    outgoing?: number;
    incoming: readonly number[];
    rails: readonly Rail[];
}> = (props) => {
    return (
        <svg viewBox={`0 0 ${x(props.rails.length + 1)} 50`} height="3rem">
            {!!props.outgoing && (
                <BranchMergeLine sourceRail={props.outgoing} targetRail={props.rail} />
            )}
            {props.incoming.map((r, index) => (
                <BranchMergeLine
                    key={`bml-${index}`}
                    sourceRail={r}
                    targetRail={props.rail}
                    isBranch
                />
            ))}
            <path
                d={`M ${x(props.rail)} ${props.hasParent ? 50 : 25} V ${props.hasChild ? 0 : 25}`}
                stroke={`hsl(${props.rail * 100}, 100%, calc(50% - (var(--lightness) - 50%) / 2))`}
                strokeWidth={lineWidth}
            />
            <circle
                cx={x(props.rail)}
                cy={25}
                r={nodeRadius}
                stroke={`hsl(${props.rail * 100}, 100%, calc(50% - (var(--lightness) - 50%) / 2))`}
                fill={`hsl(${props.rail * 100}, 100%, calc(50% + (var(--lightness) - 50%) / 3))`}
                strokeWidth={1}
            />
            {props.rails.reduce((lines, r, index) => {
                if (r !== undefined && index !== props.rail && index !== props.outgoing) {
                    return [
                        ...lines,
                        <path
                            key={`line-${index}`}
                            d={`M ${x(index)} 0 v 50`}
                            stroke={`hsl(${
                                index * 100
                            }, 100%, calc(50% - (var(--lightness) - 50%) / 2))`}
                            strokeWidth={lineWidth}
                        />,
                    ];
                }
                return lines;
            }, [] as JSX.Element[])}
        </svg>
    );
};
