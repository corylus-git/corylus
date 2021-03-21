import React from 'react';
import { StyledDialog } from '../util/StyledDialog';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';
import { Formik, Form, Field } from 'formik';
import { StyledInput } from '../util/StyledInput';
import { Logger } from '../../../util/logger';
import { remoteCheckout } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';

export const CheckoutRemoteDialog: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'request-remote-checkout' ? (
        <Modal isOpen={true}>
            <StyledDialog>
                <div>
                    Check out{' '}
                    <code>
                        {dialog.remote.remote}/{dialog.remote.ref}
                    </code>
                    ?
                </div>
                <Formik
                    onSubmit={(values) => {
                        remoteCheckout(dialog.remote, values.local);
                        dialog.close();
                    }}
                    onReset={() => {
                        Logger().silly('CheckoutRemoteDialog', 'Canceled remote checkout');
                        dialog.close();
                    }}
                    initialValues={{ local: dialog.remote.ref }}>
                    <Form>
                        <label>
                            Local tracking branch: <Field as={StyledInput} name="local" />
                        </label>
                        <ButtonGroup>
                            <StyledButton type="submit">Create tracking branch</StyledButton>
                            <StyledButton type="reset">Cancel</StyledButton>
                        </ButtonGroup>
                    </Form>
                </Formik>
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
