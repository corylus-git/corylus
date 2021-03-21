import React from 'react';
import { StyledDialog } from '../util/StyledDialog';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';
import { Formik } from 'formik';
import { StyledInput } from '../util/StyledInput';
import { Logger } from '../../../util/logger';
import { stash } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';

export const RequestStashDialog: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'request-stash' ? (
        <Modal isOpen={true}>
            <Formik
                initialValues={{ stashUntracked: false, stashMessage: '' }}
                onSubmit={(values, _) => {
                    Logger().debug('RequestStashDialog', 'Sending stash command', {
                        values: values,
                    });
                    stash(values.stashMessage, values.stashUntracked);
                    dialog.close();
                }}>
                {(formik) => (
                    <StyledDialog>
                        <form
                            onSubmit={formik.handleSubmit}
                            onReset={() => {
                                Logger().debug('RequestStashDialog', 'Canceled stash dialog');
                                dialog.close();
                            }}>
                            <div>Stash current modifications</div>
                            <StyledInput
                                type="text"
                                id="stashMessage"
                                placeholder="Message"
                                {...formik.getFieldProps('stashMessage')}
                            />
                            <StyledInput
                                type="checkbox"
                                id="stashUntracked"
                                {...formik.getFieldProps('stashUntracked')}
                            />
                            <label htmlFor="stashUntracked">
                                Stash all untracked files as well
                            </label>
                            <ButtonGroup>
                                <StyledButton type="submit">Stash</StyledButton>
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
