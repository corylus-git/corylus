import React from 'react';
import { StyledDialog } from '../util/StyledDialog';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';
import { Formik } from 'formik';
import { StyledInput } from '../util/StyledInput';
import { Logger } from '../../../util/logger';
import { applyStash } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';

export const RequestStashApplyDialog: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'request-stash-apply' ? (
        <Modal isOpen={true}>
            <Formik
                initialValues={{ deleteAfterApplication: false }}
                onSubmit={(values, _) => {
                    Logger().debug(
                        'RequestStashApplyDialog',
                        'Sending stash apply command',
                        values
                    );
                    applyStash(dialog.stash, values.deleteAfterApplication);
                    dialog.close();
                }}>
                {(formik) => (
                    <StyledDialog>
                        <form
                            onSubmit={formik.handleSubmit}
                            onReset={() => {
                                Logger().debug(
                                    'RequestStashApplyDialog',
                                    'Canceled stash apply dialog'
                                );
                                dialog.close();
                            }}>
                            <div>Apply {dialog.stash.message}?</div>
                            <StyledInput
                                type="checkbox"
                                id="deleteAfterApplication"
                                {...formik.getFieldProps('deleteAfterApplication')}
                            />
                            <label htmlFor="stashUntracked">
                                Delete {dialog.stash.ref} after successful application
                            </label>
                            <ButtonGroup>
                                <StyledButton type="submit">Apply</StyledButton>
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
