import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { Formik } from 'formik';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { resetBranch } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';

export const BranchResetDialog: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'request-branch-reset' ? (
        <Modal isOpen={true}>
            <StyledDialog>
                <Formik
                    initialValues={{ resetType: 'mixed' }}
                    onSubmit={(value, _) => {
                        resetBranch(dialog.branch, dialog.toRef, value.resetType);
                        dialog.close();
                    }}
                    onReset={() => dialog.close()}>
                    {(formik) => (
                        <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
                            <div>
                                <p>
                                    Reset {dialog.branch} to commit {dialog.toRef}?
                                </p>
                                <p>
                                    <label>
                                        <span style={{ marginRight: '1rem' }}>Reset mode:</span>
                                        <select {...formik.getFieldProps('resetType')}>
                                            <option value="soft">
                                                Soft -- leave index &amp; working tree untouched
                                            </option>
                                            <option value="mixed">
                                                Mixed -- reset index, leave working tree untouched
                                            </option>
                                            <option value="hard">
                                                Hard -- reset index and working tree
                                            </option>
                                        </select>
                                    </label>
                                </p>
                                <ButtonGroup>
                                    <StyledButton type="submit">Reset branch</StyledButton>
                                    <StyledButton type="reset">Cancel</StyledButton>
                                </ButtonGroup>
                            </div>
                        </form>
                    )}
                </Formik>
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
