import React, { useEffect } from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { Formik, useField } from 'formik';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { useDialog } from '../../../model/state/dialogs';
import { useRepo } from '../../../model/state/repo';
import { useQuery } from 'react-query';
import { Commit } from '../../../model/stateObjects';
import styled from 'styled-components';
import { rebase } from '../../../model/actions/repo';
import { Hoverable } from '../StyleBase';

type RebaseAction = 'pick' | 'squash' | 'drop';

type PickerEntryProps = {
    commit: Commit;
    name: string;
    hasPredecessor?: boolean;
    isSelected: boolean;
    onSelect: (commit: Commit, ctrlPressed: boolean, shiftPressed: boolean) => void;
    onChange: (newValue: RebaseAction) => void;
};

const PickerEntry: React.FC<PickerEntryProps> = (props) => {
    const [field, meta] = useField(props.name);
    return (
        <PickerEntryContainer
            isSelected={props.isSelected}
            onClick={(ev) => props.onSelect(props.commit, ev.ctrlKey, ev.shiftKey)}>
            <td>
                <select
                    {...field}
                    onChange={(ev) => {
                        switch (ev.target.value) {
                            case 'pick':
                            case 'squash':
                            case 'drop':
                                props.onChange(ev.target.value);
                                break;
                        }
                        field.onChange(ev);
                    }}>
                    <option>pick</option>
                    {props.hasPredecessor && <option>squash</option>}
                    <option>drop</option>
                </select>
            </td>
            <td>{props.commit.short_oid}</td>
            <td>{props.commit.author.timestamp.toLocaleString()}</td>
            <td>{props.commit.author.name}</td>
            <td>
                <span>{props.commit.message}</span>
            </td>
        </PickerEntryContainer>
    );
};

const PickerEntryContainer = styled.tr<{ isSelected: boolean }>`
    ${Hoverable}
    td {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
        background-color: ${(props) => (props.isSelected ? 'var(--selected)' : undefined)};
    }
`;

function hasPredecessor(value: RebaseAction[], index: number): boolean {
    return value.slice(0, index).some((a) => a === 'pick');
}

const CommitPicker: React.FC<{ target: string; onClose: () => void }> = (props) => {
    const repo = useRepo();
    const query = useQuery('interactive-rebase', () =>
        repo.backend.getHistory(undefined, undefined, undefined, `${props.target}..HEAD`)
    );
    const reverseHistory = React.useMemo(() => [...(query.data ?? [])].reverse(), [query.data]);
    const [selectedCommits, setSelectedCommits] = React.useState<Commit[]>([]);

    const onSelectEntry = (commit: Commit, ctrlPressed: boolean, shiftPressed: boolean) => {
        if (ctrlPressed) {
            if (selectedCommits.includes(commit)) {
                setSelectedCommits(selectedCommits.filter((c) => c !== commit));
            } else {
                setSelectedCommits([...selectedCommits, commit]);
            }
        } else if (shiftPressed) {
            if (!selectedCommits.includes(commit)) {
                if (selectedCommits.length === 0) {
                    setSelectedCommits([commit]);
                }
                const startIdx = reverseHistory.findIndex((c) => c === selectedCommits[0]);
                const endIdx = reverseHistory.findIndex((c) => c === commit);
                const direction = startIdx < endIdx ? 1 : -1;
                const sc = [selectedCommits[0]];
                for (let i = startIdx + direction; i !== endIdx + direction; i += direction) {
                    sc.push(reverseHistory[i]);
                }
                setSelectedCommits(sc);
            }
        } else {
            setSelectedCommits([commit]);
        }
    };

    if (query.isLoading) {
        return <>Loading...</>;
    }
    if (query.error) {
        return <h2>Could not load differences to target.</h2>;
    }

    return (
        <Modal isOpen={true}>
            <StyledDialog>
                <h2>Interactive rebase</h2>
                <Formik
                    initialValues={{
                        action: (reverseHistory?.map((_) => 'pick') ?? []) as RebaseAction[],
                    }}
                    onSubmit={(value, _) => {
                        (async () => {
                            const commitActions = value.action.map((action, index) => ({
                                action: action,
                                commit: reverseHistory![index],
                            }));
                            try {
                                await rebase(props.target, commitActions);
                            } finally {
                                props.onClose();
                            }
                        })();
                    }}
                    onReset={() => props.onClose()}>
                    {(formik) => (
                        <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
                            <div style={{ maxHeight: '80vh', overflow: 'scroll' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Action</th>
                                            <th>Commit</th>
                                            <th>Time</th>
                                            <th>Author</th>
                                            <th>Message</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reverseHistory?.map((entry, index) => (
                                            <PickerEntry
                                                key={entry.oid}
                                                name={`action[${index}]`}
                                                commit={entry}
                                                hasPredecessor={hasPredecessor(
                                                    formik.values.action,
                                                    index
                                                )}
                                                onSelect={onSelectEntry}
                                                isSelected={
                                                    !!selectedCommits.find((c) => c === entry)
                                                }
                                                onChange={(
                                                    newValue: 'pick' | 'squash' | 'drop'
                                                ) => {
                                                    const values = [...formik.values.action];
                                                    // Note: we're working in history order as to not break the hasPredecessor call below
                                                    for (const [
                                                        idx,
                                                        c,
                                                    ] of reverseHistory.entries()) {
                                                        if (
                                                            selectedCommits.includes(c) &&
                                                            (hasPredecessor(values, idx) ||
                                                                newValue !== 'squash')
                                                        ) {
                                                            values[idx] = newValue;
                                                        }
                                                    }
                                                    formik.setValues({ action: values });
                                                }}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <ButtonGroup>
                                    <StyledButton type="submit">Rebase</StyledButton>
                                    <StyledButton type="reset">Cancel</StyledButton>
                                </ButtonGroup>
                            </div>
                        </form>
                    )}
                </Formik>
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
