import { useDialog } from '../../model/state/dialogs';
import React from 'react';
import { StyledDialog } from '../util/StyledDialog';
import { Formik } from 'formik';
import { Logger } from '../../util/logger';
import { StyledInput } from '../util/StyledInput';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import styled from 'styled-components';
import { addRemote, updateRemote } from '../../model/actions/repo';
import { ModalDialog } from './ModalDialog';

const DialogView = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-row-gap: 0.5rem;

    .full {
        grid-column: 1/3;
    }
`;

export const RemoteConfigurationDialog: React.FC = () => {
    const dialog = useDialog();

    return (
        <ModalDialog for="remote-configuration">
            {dialog.type === 'remote-configuration' && <Formik
                initialValues={{
                    remoteName: dialog.remote.found ? dialog.remote.value.remote : '',
                    url: dialog.remote.found ? dialog.remote.value.url : '',
                }}
                onSubmit={async (values, _) => {
                    Logger().silly('RemoteConfigurationDialog', 'Setting remote configuration', {
                        remote: values,
                    });
                    if (!dialog.remote.found) {
                        await addRemote(values.remoteName, values.url);
                    } else {
                        await updateRemote(values.remoteName, values.url);
                    }
                    dialog.close();
                    dialog.onConfirm?.();
                }}
                validate={({ remoteName, url }) => {
                    const errors: any = {};
                    if (!remoteName) {
                        errors.remoteName = 'Please enter a valid remote name';
                    }
                    if (!url) {
                        errors.url = 'Please enter a URL for the remote';
                    }
                    return errors;
                }}
                initialErrors={{
                    remoteName: 'Please enter a valid remote name',
                    url: 'Please enter a URL for the remote',
                }}
                onReset={() => dialog.close()}>
                {(formik) => (
                    <StyledDialog>
                        <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
                            <>
                                <DialogView>
                                    <div className="full">
                                        {dialog.remote.found
                                            ? `Configure remote ${dialog.remote.value.remote}`
                                            : 'Configure new remote repository'}
                                    </div>
                                    <label htmlFor="remoteName">Name: </label>
                                    <StyledInput
                                        id="remoteName"
                                        {...formik.getFieldProps('remoteName')}
                                        placeholder="Name"
                                        disabled={dialog.remote.found}
                                    />
                                    <label htmlFor="url">URL:</label>
                                    <StyledInput
                                        id="url"
                                        {...formik.getFieldProps('url')}
                                        placeholder="URL / path"
                                    />
                                </DialogView>
                            </>
                            <ButtonGroup>
                                <StyledButton disabled={!formik.isValid} type="submit">
                                    Save
                                </StyledButton>
                                <StyledButton type="reset">Cancel</StyledButton>
                            </ButtonGroup>
                        </form>
                    </StyledDialog>
                )}
            </Formik>}
        </ModalDialog>);
};
