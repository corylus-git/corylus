import * as React from 'react';
import { Splitter, SplitterPanel } from '../util/Splitter';
import { Branches } from '../Branches/Branches';
import { GraphPanel } from './Graph';
import { CommitDetailsView } from '../Diff/Commit';
import { useState, useRef } from 'react';
import { Logger } from '../../util/logger';
import { NoScrollPanel } from '../util/NoScrollPanel';

let splitterX: string | undefined = undefined;
let splitterY = 'minmax(0,1fr)';

/**
 * The main view showing the history of the open repository
 */
export const HistoryPanel: React.FC = () => {
    const targetRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const resizeObserverRef = useRef<ResizeObserver>(new ResizeObserver(resizer));

    React.useEffect(() => {
        if (targetRef.current) {
            resizeObserverRef.current.observe(targetRef.current);
        }
        return () => resizeObserverRef.current.disconnect();
    }, [targetRef.current]);

    function resizer(entries: ResizeObserverEntry[]) {
        Logger().silly('HistoryPanel', 'Resizing graph to', { dimensions: dimensions });
        for (const entry of entries) {
            setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
        }
    }

    return (
        <Splitter onMove={(pos) => (splitterX = `${pos}px`)} initialPosition={splitterX}>
            <Branches />
            <Splitter
                horizontal
                initialPosition={splitterY}
                noWrap
                onMove={(position) => {
                    setDimensions({ width: dimensions.width, height: position });
                    splitterY = `${position}px`;
                }}>
                <NoScrollPanel ref={targetRef}>
                    <GraphPanel
                        width={dimensions.width}
                        height={dimensions.height - 10}
                    />
                </NoScrollPanel>
                <SplitterPanel>
                    <CommitDetailsView />
                </SplitterPanel>
            </Splitter>
        </Splitter>
    );
};
