import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';
import styled from 'styled-components';
import { Formik } from 'formik';
import { deleteBranch } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';

const Warning = styled.div`
    color: #a0a000;
`;

export const DeleteBranchDialog: React.FC = () => {
    const dialog = useDialog();

    if (dialog.type === 'request-delete-branch') {
        return (
            <Modal isOpen={true}>
                <Formik
                    initialValues={{ confirm: !dialog.isUnmerged, removeRemote: false }}
                    onSubmit={(values, _) => {
                        deleteBranch(dialog.branch, values.confirm, values.removeRemote);
                        dialog.close();
                    }}
                    initialErrors={dialog.isUnmerged ? { confirm: 'Needs confirmation' } : {}} // the initial state is not valid, if the branch is not fully merged into HEAD
                    validate={(values) => {
                        const errors: any = {};
                        if (dialog.isUnmerged && !values.confirm) {
                            errors.from = 'Please confirm deletion of unmerged branch';
                        }
                        return errors;
                    }}>
                    {(formik) => (
                        <StyledDialog>
                            <form onSubmit={formik.handleSubmit}>
                                <div>
                                    Really delete branch{' '}
                                    {dialog.branch.remote
                                        ? `${dialog.branch.remote}/${dialog.branch.ref}`
                                        : dialog.branch.ref}{' '}
                                    ?
                                </div>
                                {dialog.isUnmerged ? (
                                    <Warning>
                                        <input
                                            type="checkbox"
                                            id="confirm"
                                            {...formik.getFieldProps('confirm')}
                                        />
                                        <label htmlFor="confirm">
                                            This branch is not fully merged into your current HEAD!
                                            Delete anyway?
                                        </label>
                                    </Warning>
                                ) : (
                                    <></>
                                )}
                                {dialog.branch.upstream && (
                                    <div>
                                        <input
                                            type="checkbox"
                                            id="removeRemote"
                                            {...formik.getFieldProps('removeRemote')}
                                        />
                                        <label htmlFor="removeRemote">
                                            Remove remote tracking branch{' '}
                                            {dialog.branch.upstream?.remoteName}/
                                            {dialog.branch.upstream?.ref}
                                        </label>
                                    </div>
                                )}
                                <ButtonGroup>
                                    <StyledButton disabled={!formik.isValid} type="submit">
                                        Delete branch
                                    </StyledButton>
                                    <StyledButton type="reset" onClick={(_) => dialog.close()}>
                                        Cancel
                                    </StyledButton>
                                </ButtonGroup>
                            </form>
                        </StyledDialog>
                    )}
                </Formik>
            </Modal>
        );
    }
    return <></>;
};
