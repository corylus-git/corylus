import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const RunningIndicatorContainer = styled.div<{ factor: number }>`
    position: relative;
    margin: 0;
    display: inline-block;
    padding: 0;
    width: ${(props) => props.factor * 25}px;
`;

const Dot = styled(motion.div)<{ factor: number }>`
    background-color: ${(props) => props.theme.colors.selected};
    width: ${(props) => props.factor * 5}px;
    height: ${(props) => props.factor * 5}px;
    border-radius: 50%;
    position: absolute;
    top: ${(props) => props.factor * 6}px;
`;

export const RunningIndicator: React.FC<{ active: boolean; size?: number }> = (props) => {
    const factor = props.size ?? 1.0;
    return props.active ? (
        <RunningIndicatorContainer factor={factor}>
            <Dot
                animate={{ left: [2 * factor, 20 * factor, 2 * factor] }}
                transition={{
                    duration: 1,
                    loop: Infinity,
                    times: [0, 0.5, 1],
                    ease: 'easeInOut',
                }}
                factor={factor}
            />
            <Dot
                animate={{ left: [2 * factor, 20 * factor, 2 * factor] }}
                transition={{
                    duration: 1,
                    loop: Infinity,
                    times: [0, 0.5, 1],
                    ease: 'easeInOut',
                    delay: 0.75,
                }}
                factor={factor}
            />
            <Dot
                animate={{ left: [2 * factor, 20 * factor, 2 * factor] }}
                transition={{
                    duration: 1,
                    loop: Infinity,
                    times: [0, 0.5, 1],
                    ease: 'easeInOut',
                    delay: 1.5,
                }}
                factor={factor}
            />
        </RunningIndicatorContainer>
    ) : (
        <></>
    );
};
