import * as React from 'react';
import { Splitter, SplitterPanel } from '../util/Splitter';
import { Branches } from '../Branches/Branches';
import { Graph } from './Graph';
import { CommitDetailsView } from '../Diff/Commit';
import { useState, useRef, useLayoutEffect } from 'react';
import { Logger } from '../../../util/logger';
import { NoScrollPanel } from '../util/NoScrollPanel';
import { useHistory } from '../../../model/state/repo';

/**
 * The main view showing the history of the open repository
 */
export const HistoryPanel: React.FC = () => {
    const targetRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const history = useHistory();

    useLayoutEffect(resizer, []);

    function resizer() {
        Logger().silly('HistoryPanel', 'Resizing graph to', { dimensions: dimensions });
        if (targetRef.current) {
            setDimensions({
                width: targetRef.current.offsetWidth,
                height: targetRef.current.offsetHeight,
            });
        }
    }

    React.useEffect(() => {
        window.addEventListener('resize', resizer);
        return () => window.removeEventListener('resize', resizer);
    }, []);

    return (
        <Splitter>
            <Branches />
            <Splitter
                horizontal
                initialPosition="minmax(0,1fr)"
                noWrap
                onMove={(position) => setDimensions({ width: dimensions.width, height: position })}>
                <NoScrollPanel ref={targetRef}>
                    <Graph
                        width={dimensions.width}
                        height={dimensions.height - 10}
                        history={history}
                    />
                </NoScrollPanel>
                <SplitterPanel>
                    <CommitDetailsView />
                </SplitterPanel>
            </Splitter>
        </Splitter>
    );
};
