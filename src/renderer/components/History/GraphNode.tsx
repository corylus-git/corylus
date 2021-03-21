import React from 'react';
import { x, BranchMergeLine, Rail, lineWidth, nodeRadius } from './RailLine';
import { useTheme } from 'styled-components';

export const GraphNode: React.FC<{
    rail: number;
    hasParent: boolean;
    hasChild: boolean;
    outgoing?: number;
    incoming: readonly number[];
    rails: readonly Rail[];
}> = (props) => {
    const theme = useTheme();
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
                stroke={theme.colors.graph.borders[props.rail % theme.colors.graph.borders.length]}
                strokeWidth={lineWidth}
            />
            <circle
                cx={x(props.rail)}
                cy={25}
                r={nodeRadius}
                fill={theme.colors.graph.colors[props.rail % theme.colors.graph.colors.length]}
                strokeWidth={1}
                stroke={theme.colors.graph.borders[props.rail % theme.colors.graph.borders.length]}
            />
            {props.rails.reduce((lines, r, index) => {
                if (r !== undefined && index !== props.rail && index !== props.outgoing) {
                    return [
                        ...lines,
                        <path
                            key={`line-${index}`}
                            d={`M ${x(index)} 0 v 50`}
                            stroke={
                                theme.colors.graph.borders[
                                    index % theme.colors.graph.borders.length
                                ]
                            }
                            strokeWidth={lineWidth}
                        />,
                    ];
                }
                return lines;
            }, [] as JSX.Element[])}
        </svg>
    );
};
