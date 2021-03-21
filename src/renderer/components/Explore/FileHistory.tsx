import React from 'react';
import { Logger } from '../../../util/logger';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { Graph, GraphRenderer } from '../History/Graph';
import { Splitter, SplitterPanel } from '../util/Splitter';
import { NoScrollPanel } from '../util/NoScrollPanel';
import { CommitDetailsView } from '../Diff/Commit';
import { useFileHistory, explorer } from '../../../model/state/explorer';
import { calculateGraphLayout } from '../../../util/graphLayout';

const HistoryContainer = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-rows: 1fr 3rem;
    justify-items: center;
    z-index: 100;
    background-color: ${(props) => props.theme.colors.background};
    > .button {
        padding: 0.25rem;
        > button {
            width: 20rem;
            height: 2rem;
        }
    }
`;

export const FileHistory: React.FC = () => {
    const history = useFileHistory();
    const graph = React.useMemo(
        () => (history.found ? calculateGraphLayout(history.value) : { lines: [], rails: [] }),
        [history]
    );
    const targetRef = React.useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

    React.useLayoutEffect(resizer, [history, targetRef.current]);

    function resizer() {
        Logger().silly('FileHistory', 'Resizing graph to', { dimensions: dimensions });
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
    return history.found ? (
        <div>
            <HistoryContainer>
                <Splitter
                    initialPosition="minmax(0,1fr)"
                    noWrap
                    onMove={(position) => {
                        setDimensions({
                            width: position,
                            height: dimensions.height,
                        });
                    }}>
                    <NoScrollPanel ref={targetRef}>
                        <GraphRenderer
                            width={dimensions.width - 10}
                            height={dimensions.height}
                            lines={graph.lines}
                            rails={graph.rails}
                            totalCommits={graph.lines.length}
                            first={0}
                        />
                    </NoScrollPanel>
                    <SplitterPanel>
                        <CommitDetailsView />
                    </SplitterPanel>
                </Splitter>
                <div className="button">
                    <StyledButton onClick={() => explorer.getState().closePathHistory()}>
                        Close
                    </StyledButton>
                </div>
            </HistoryContainer>
        </div>
    ) : (
        <></>
    );
};
