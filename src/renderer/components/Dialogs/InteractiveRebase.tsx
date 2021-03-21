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

const PickerEntry: React.FC<{ commit: Commit; name: string; hasPredecessor?: boolean }> = (
    props
) => {
    const [field, meta] = useField(props.name);
    return (
        <PickerEntryContainer>
            <td>
                <select {...field}>
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

const PickerEntryContainer = styled.tr`
    td {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
    }
`;

const CommitPicker: React.FC<{ target: string; onClose: () => void }> = (props) => {
    const repo = useRepo();
    const query = useQuery('interactive-rebase', () =>
        repo.backend.getHistory(undefined, undefined, undefined, `${props.target}..HEAD`)
    );
    const reverseHistory = React.useMemo(() => [...(query.data ?? [])].reverse(), [query.data]);

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
                        action: reverseHistory?.map((_) => 'pick') ?? [],
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
                                                hasPredecessor={formik.values.action
                                                    .slice(0, index)
                                                    .some((a) => a === 'pick')}
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
