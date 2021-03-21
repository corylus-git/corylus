import React from 'react';
import { StyledDialog } from '../util/StyledDialog';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';
import { Formik } from 'formik';
import { StyledInput } from '../util/StyledInput';
import { fetchRemote } from '../../../model/actions/repo';
import { nothing } from '../../../util/maybe';
import { useDialog } from '../../../model/state/dialogs';

export const RequestFetchDialog: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'simple-dialog' && dialog.dialog === 'RequestFetch' ? (
        <Modal isOpen={true}>
            <Formik
                initialValues={{ fetchAll: true, prune: false }}
                onSubmit={(values, _) => {
                    fetchRemote(nothing, nothing, values.prune);
                    dialog.close();
                }}>
                {(formik) => (
                    <StyledDialog>
                        <form onSubmit={formik.handleSubmit} onReset={() => dialog.close()}>
                            <div>Fetch remotes</div>
                            <StyledInput
                                type="checkbox"
                                id="prune"
                                {...formik.getFieldProps('prune')}
                            />
                            <label htmlFor="prune">
                                Remove tracking branches no longer present in remote repository
                            </label>
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
