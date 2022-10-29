import React from 'react';
import { StyledDialog } from '../util/StyledDialog';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';
import { Formik } from 'formik';
import { StyledInput } from '../util/StyledInput';
import { fetchRemote } from '../../model/actions/repo';
import { just, nothing } from '../../util/maybe';
import { useDialog } from '../../model/state/dialogs';
import { useRemotes } from '../../model/state/repo';

export const RequestFetchDialog: React.FC = () => {
    const dialog = useDialog();
    const remotes = useRemotes();
    return dialog.type === 'simple-dialog' && dialog.dialog === 'RequestFetch' ? (
        <Modal isOpen={true}>
            <Formik
                initialValues={{
                    fetchAll: true,
                    prune: true,
                    tags: true,
                    remote: remotes[0]?.remote,
                }}
                onSubmit={(values, _) => {
                    fetchRemote(
                        values.fetchAll ? nothing : just(values.remote),
                        nothing,
                        values.prune,
                        values.tags
                    );
                    dialog.close();
                }}>
                {(formik) => (
                    <StyledDialog>
                        <form onSubmit={formik.handleSubmit} onReset={() => dialog.close()}>
                            <div>Fetch remotes</div>
                            <div>
                                <StyledInput
                                    type="checkbox"
                                    id="prune"
                                    {...formik.getFieldProps('prune')}
                                    checked={formik.values.prune}
                                />
                                <label htmlFor="prune">
                                    Remove tracking branches no longer present in remote repository
                                </label>
                            </div>
                            <div>
                                <StyledInput
                                    type="checkbox"
                                    id="all"
                                    {...formik.getFieldProps('fetchAll')}
                                    checked={formik.values.fetchAll}
                                />
                                <label htmlFor="all">Fetch changes from all remotes</label>
                                <div style={{ marginLeft: '2em' }}>
                                    <label htmlFor="remotes">Select remote to fetch from </label>
                                    <select
                                        id="remotes"
                                        disabled={formik.values.fetchAll}
                                        {...formik.getFieldProps('remote')}>
                                        {remotes.map((r) => (
                                            <option key={r.remote}>{r.remote}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <StyledInput
                                    type="checkbox"
                                    id="tags"
                                    {...formik.getFieldProps('tags')}
                                    checked={formik.values.tags}
                                />
                                <label htmlFor="all">Fetch tags</label>
                            </div>
                            <ButtonGroup>
                                <StyledButton type="submit">OK</StyledButton>
                                <StyledButton type="reset">Cancel</StyledButton>
                            </ButtonGroup>
                        </form>
                    </StyledDialog>
                )}
            </Formik>
        </Modal>
    ) : (
        <></>
    );
};
