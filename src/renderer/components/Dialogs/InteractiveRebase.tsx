import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { Formik, useField } from 'formik';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { useDialog } from '../../../model/state/dialogs';
import { useBranches, useRepo, useTags } from '../../../model/state/repo';
import styled from 'styled-components';
import { rebase } from '../../../model/actions/repo';
import { DropDownList, Hoverable } from '../StyleBase';
import AutoSizer from 'react-virtualized-auto-sizer';
import { NoScrollPanel } from '../util/NoScrollPanel';
import { useAsync } from 'react-use';
import { calculateGraphLayout } from '../../../util/graphLayout';
import { GraphLine } from '../History/GraphRenderer';
import { SelectableList, SelectableListEntryProps } from '../util/SelectableList';

type RebaseAction = 'pick' | 'squash' | 'drop';

function hasPredecessor(value: RebaseAction[], index: number): boolean {
    return value.slice(0, index).some((a) => a === 'pick');
}

const CommitPickerLine = styled.div`
    display: grid;
    grid-template-columns: 7em 1fr;
    align-items: center;
`;

const CommitPicker: React.FC<{ target: string; onClose: () => void }> = (props) => {
    const repo = useRepo();
    const history = useAsync(
        () => repo.backend.getHistory(undefined, undefined, undefined, `${props.target}..HEAD`),
        [props.target]
    );
    const tags = useTags();
    const branches = useBranches();
    const graph = React.useMemo(() => {
        const layout = calculateGraphLayout([...(history.value ?? [])]);
        return {
            rails: [...layout.rails].reverse(),
            lines: [...layout.lines].reverse(),
        };
    }, [history]);
    const [rebaseActions, setRebaseActions] = React.useState<RebaseAction[]>([]);
    const currentSelection = React.useRef<number[]>([]);

    React.useEffect(() => {
        if (history.value) {
            setRebaseActions(history.value.map((_) => 'pick'));
        }
    }, [history.value]);

    const selectAction = (action: RebaseAction, index: number) => {
        if (history.value) {
            const newActions = [...rebaseActions];
            newActions[index] = action;
            if (currentSelection.current.includes(index)) {
                // Note: we're working in timeline order as to not break the hasPredecessor call below
                for (let idx = newActions.length - 1; idx >= 0; idx--) {
                    if (
                        currentSelection.current.includes(idx) &&
                        (hasPredecessor(newActions, idx) || action !== 'squash')
                    ) {
                        newActions[idx] = action;
                    }
                }
            }
            setRebaseActions(newActions);
        }
    };

    const executeRebase = () => {
        (async () => {
            const reverseHistory = [...history.value!].reverse();
            const commitActions = rebaseActions.map((action, index) => ({
                action: action,
                commit: reverseHistory[index],
            }));
            try {
                await rebase(props.target, commitActions);
            } finally {
                props.onClose();
            }
        })();
    };

    const CommitPickerEntry: React.FC<SelectableListEntryProps> = (props) => {
        return (
            <CommitPickerLine
                style={props.style}
                className={`rebase-${rebaseActions[props.index]}`}>
                <div>
                    <DropDownList
                        onChange={(ev) => {
                            switch (ev.target.value) {
                                case 'pick':
                                case 'squash':
                                case 'drop':
                                    selectAction(ev.target.value, props.index);
                                    break;
                            }
                        }}
                        value={rebaseActions[props.index]}>
                        <option>pick</option>
                        {hasPredecessor(rebaseActions, props.index) && <option>squash</option>}
                        <option>drop</option>
                    </DropDownList>
                </div>
                <div>
                    <GraphLine
                        branches={branches}
                        tags={tags}
                        data={props.data}
                        index={props.index}
                        selected={props.selected}
                        lines={graph.lines}
                        style={{}}
                        reverse
                    />
                </div>
            </CommitPickerLine>
        );
    };

    if (history.loading) {
        return <>Loading...</>;
    }
    if (history.error) {
        return <h2>Could not load differences to target.</h2>;
    }

    return (
        <Modal isOpen={true}>
            <StyledDialog>
                <h2>Interactive rebase</h2>
                {/* <Formik
                    initialValues={{
                        action: (history.value?.map((_) => 'pick') ?? []) as RebaseAction[],
                    }}
                    onSubmit={(value, _) => {
                        (async () => {
                            const commitActions = value.action.map((action, index) => ({
                                action: action,
                                commit: history.value![index],
                            }));
                            try {
                                await rebase(props.target, commitActions);
                            } finally {
                                props.onClose();
                            }
                        })();
                    }}
                    onReset={() => props.onClose()}> */}
                <NoScrollPanel style={{ height: '80vh', width: '80vw' }}>
                    <AutoSizer>
                        {({ width, height }) => (
                            <SelectableList
                                width={width}
                                height={height}
                                itemSize={48}
                                itemCount={history.value?.length ?? 0}
                                multi
                                onSelectionChange={(s) => {
                                    currentSelection.current = s;
                                }}>
                                {CommitPickerEntry}
                            </SelectableList>
                        )}
                    </AutoSizer>
                </NoScrollPanel>
                <div>
                    <ButtonGroup>
                        <StyledButton type="submit" onClick={executeRebase}>
                            Rebase
                        </StyledButton>
                        <StyledButton type="reset" onClick={props.onClose}>
                            Cancel
                        </StyledButton>
                    </ButtonGroup>
                </div>
            </StyledDialog>
        </Modal>
    );
};

export const InteractiveRebase: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'interactive-rebase' ? (
        <CommitPicker target={dialog.target} onClose={dialog.close} />
    ) : (
        <></>
    );
};
