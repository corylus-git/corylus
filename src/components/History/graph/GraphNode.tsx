import React from 'react';
import { x, BranchMergeLine, Rail, lineWidth, nodeRadius } from './RailLine';

export const GraphNode: React.FC<{
    rail: number;
    hasParentLine: boolean;
    hasChildLine: boolean;
    outgoing: readonly number[];
    incoming: readonly number[];
    rails: readonly Rail[];
    reverse?: boolean;
    width: number //< the width in numbers of rails
}> = (props) => {
    return (
        <svg
            transform={props.reverse ? 'scale(1, -1)' : undefined}
            viewBox={`0 0 ${x(props.width)} 50`}
            style={{ height: "3rem" }}>
            {props.outgoing.length > 0 && (
                // TODO draw more than one merge line
                <BranchMergeLine sourceRail={props.outgoing[0]} targetRail={props.rail} />
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
                d={`M ${x(props.rail)} ${props.hasParentLine ? 50 : 25} V ${props.hasChildLine ? 0 : 25}`}
                stroke={`hsl(${props.rail * 100}, 100%, calc(50% - (var(--lightness) - 50%) / 2))`}
                strokeWidth={lineWidth}
            />
            <circle
                className="node"
                cx={x(props.rail)}
                cy={25}
                r={nodeRadius}
                stroke={`hsl(${props.rail * 100}, 100%, calc(50% - (var(--lightness) - 50%) / 2))`}
                fill={`hsl(${props.rail * 100}, 100%, calc(50% + (var(--lightness) - 50%) / 3))`}
                strokeWidth={1}
            />
            {props.rails.reduce((lines, r, index) => {
                if (r !== null && index !== props.rail && (index !== props.outgoing[0] || props.rails[index]?.hasThroughLine)) {
                    return [
                        ...lines,
                        <path
                            key={`line-${index}`}
                            d={`M ${x(index)} 0 v 50`}
                            stroke={`hsl(${index * 100
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
