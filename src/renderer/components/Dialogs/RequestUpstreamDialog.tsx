import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { Formik } from 'formik';
import { StyledInput } from '../util/StyledInput';
import { Logger } from '../../../util/logger';
import { useDialog } from '../../../model/state/dialogs';
import { useRemotes } from '../../../model/state/repo';
import { push } from '../../../model/actions/repo';

/**
 * Open the upstream configuration dialog for pushes of branches, that do not have an upstream yet
 */
export const RequestUpstreamDialog: React.FC = () => {
    const dialog = useDialog();
    const remotes = useRemotes();
    return dialog.type === 'request-upstream' ? (
        <Modal isOpen>
            <Formik
                initialValues={{
                    remote: (remotes.length ?? 0) > 0 ? remotes![0].remote : undefined,
                    upstream: dialog.forBranch.ref ?? '',
                }}
                onSubmit={(values, { setSubmitting }) => {
                    Logger().silly('RequestUpstreamDialog', 'Submitting push command to the bus', {
                        source: dialog.forBranch.ref,
                        remote: values.remote,
                        upstream: values.upstream,
                    });
                    push(dialog.forBranch.ref, values.remote, values.upstream);
                    dialog.close();
                }}
                validate={({ remote, upstream }) => {
                    const errors: any = {};
                    if (!remote) {
                        errors.remote = 'Please select a remote to push to';
                    }
                    if (!upstream) {
                        errors.upstream = 'Please enter a name for the upstream branch';
                    }
                }}
                onReset={() => dialog.close()}>
                {(formik) => (
                    <StyledDialog>
                        <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
                            <>
                                <div>
                                    Branch {dialog.forBranch.ref} does not have an upstream branch.
                                    Create?
                                </div>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '7rem 1fr',
                                        alignItems: 'center',
                                        gridGap: '0.5rem',
                                        marginTop: '1rem',
                                    }}>
                                    <label htmlFor="remote">Target remote</label>{' '}
                                    <select id="remote" {...formik.getFieldProps('remote')}>
                                        {remotes?.map((r) => (
                                            <option key={r.remote}>{r.remote}</option>
                                        ))}
                                    </select>
                                    <label htmlFor="upstream">Remote branch </label>
                                    <StyledInput
                                        id="upstream"
                                        {...formik.getFieldProps('upstream')}
                                    />
                                </div>
                            </>
                            <ButtonGroup>
                                <StyledButton disabled={!formik.isValid} type="submit">
                                    Push
                                </StyledButton>
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
