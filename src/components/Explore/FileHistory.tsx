import React from 'react';
import { Logger } from '../../util/logger';
import styled from 'styled-components';
import { StyledButton } from '../util/StyledButton';
import { Splitter, SplitterPanel } from '../util/Splitter';
import { NoScrollPanel } from '../util/NoScrollPanel';
import { CommitDetailsContent } from '../Diff/Commit';
import { useFileHistory } from '../../model/state/explorer';
import { GraphRenderer } from '../History/GraphRenderer';
import { useBranches, useTags } from '../../model/state/repo';
import { useAsync } from 'react-use';
import { Commit } from '../../model/stateObjects';
import { just, nothing } from '../../util/maybe';
import { getCommitStats } from '../../model/actions/repo';

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
    background-color: var(--background);
    > .button {
        padding: 0.25rem;
        > button {
            width: 20rem;
            height: 2rem;
        }
    }
`;

export const FileHistory: React.FC<{ path: string, onClose: () => void }> = ({ path, onClose }) => {
    const history = useFileHistory(path);
    const targetRef = React.useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const tags = useTags();
    const branches = useBranches();
    const [selectedCommit, setSelectedCommit] = React.useState<Commit>();
    const stats = useAsync(async () => {
        return selectedCommit ? getCommitStats(selectedCommit.oid) : undefined;
    }, [selectedCommit])

    React.useLayoutEffect(resizer, [history, targetRef.current]);

    function resizer() {
        Logger().silly('FileHistory', 'Resizing graph to', { dimensions: dimensions });
        if (targetRef.current && (dimensions.width !== targetRef.current.offsetWidth || dimensions.height !== targetRef.current.offsetHeight)) {
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
    return history.data ? (
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
                            totalCommits={history.data.lines.length ?? 0}
                            first={0}
                            tags={tags}
                            branches={branches.data ?? []}
                            onCommitsSelected={(commit) => setSelectedCommit(commit[0])}
                            getLine={(idx) => Promise.resolve(history.data.lines![idx])}
                        />
                    </NoScrollPanel>
                    <SplitterPanel>
                        <CommitDetailsContent stats={stats.value ? just(stats.value) : nothing} />
                    </SplitterPanel>
                </Splitter>
                <div className="button">
                    <StyledButton onClick={onClose}>
                        Close
                    </StyledButton>
                </div>
            </HistoryContainer>
        </div>
    ) : (
        <></>
    );
};
