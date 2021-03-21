import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { Formik } from 'formik';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { toOptional } from '../../../util/maybe';
import { pull } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';
import { useCurrentBranch, useRemotes, useBranches } from '../../../model/state/repo';

export const PullDialog: React.FC = () => {
    const dialog = useDialog();
    const currentBranch = useCurrentBranch();
    const remotes = useRemotes();
    const branches = useBranches();

    return dialog.type === 'request-pull' ? (
        <Modal isOpen={true}>
            <StyledDialog>
                <Formik
                    onSubmit={(values) => {
                        pull(values.remote, values.remoteBranch, values.noFF);
                        dialog.close();
                    }}
                    onReset={() => dialog.close()}
                    initialValues={{
                        remoteBranch: toOptional(currentBranch)?.upstream?.ref ?? '',
                        remote: toOptional(currentBranch)?.upstream?.remoteName ?? '',
                        noFF: false,
                    }}>
                    {(formik) => (
                        <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
                            <p>Pull changes from remote into {toOptional(currentBranch)?.ref}?</p>
                            <p>
                                <label>
                                    Remote:
                                    <select
                                        {...formik.getFieldProps('remote')}
                                        onChange={(ev) => {
                                            formik.setFieldValue('remote', ev.currentTarget.value);
                                            formik.setFieldValue(
                                                'remoteBranch',
                                                branches?.find(
                                                    (b) => b.remote === ev.currentTarget.value
                                                )?.ref
                                            );
                                        }}>
                                        {remotes?.map((r) => (
                                            <option key={r.remote}>{r.remote}</option>
                                        ))}
                                    </select>
                                </label>
                            </p>
                            <p>
                                <label>
                                    Remote branch:
                                    <select {...formik.getFieldProps('remoteBranch')}>
                                        {branches
                                            ?.filter((b) => b.remote === formik.values.remote)
                                            .map((b) => (
                                                <option key={b.ref}>{b.ref}</option>
                                            ))}
                                    </select>
                                </label>
                            </p>
                            <p>
                                <label>
                                    <input type="checkbox" {...formik.getFieldProps('noFF')} />{' '}
                                    Always create a merge commit (no fast-forward)
                                </label>
                            </p>
                            <ButtonGroup>
                                <StyledButton type="submit">Pull changes</StyledButton>
                                <StyledButton type="reset">Cancel</StyledButton>
                            </ButtonGroup>
                        </form>
                    )}
                </Formik>
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
