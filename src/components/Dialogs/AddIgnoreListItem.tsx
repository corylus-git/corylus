import React, { Suspense, lazy } from 'react';
import { Modal } from '../util/Modal';
import styled from 'styled-components';
import { StyledDialog } from '../util/StyledDialog';
import { dirname, extname } from '@tauri-apps/api/path';
import { StyledInput } from '../util/StyledInput';
import { useDialog } from '../../model/state/dialogs';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { Formik, Field, Form } from 'formik';
import { addToGitIgnore } from '../../model/actions/repo';
import { AsyncValue } from '../shared/AsyncValue';

export interface AddIgnoreListItemProps {
    path: string;
}

const AddIgnoreItemDialog = styled(StyledDialog)`
    display: grid;
    grid-template-columns: 1rem 1fr;

    .full {
        grid-column: 1/3;
    }
`;

export const AddIgnoreListItem: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'add-ignore-list-item' ? (
        <Modal isOpen={true}>
            <Formik
                initialValues={{
                    addType: 'fullpath',
                    custom: dialog.path,
                }}
                onSubmit={async (values, _) => {
                    switch (values.addType) {
                        case 'fullpath':
                            addToGitIgnore(dialog.path);
                            break;
                        case 'extension':
                            addToGitIgnore(`*${await extname(dialog.path)}`);
                            break;
                        case 'parent':
                            addToGitIgnore(await dirname(dialog.path));
                            break;
                        case 'custom':
                            addToGitIgnore(values.custom);
                            break;
                    }
                    dialog.close();
                }}
                onReset={() => dialog.close()}>
                {(_) => (
                    <Form>
                        <AddIgnoreItemDialog>
                            <p className="full">
                                Add <code>{dialog.path}</code> to <code>.gitignore</code>?
                            </p>
                            <Field type="radio" id="fullpath" name="addType" value="fullpath" />
                            <label htmlFor="fullpath">
                                Only add <code>{dialog.path}</code>
                            </label>
                            <Field type="radio" id="extension" name="addType" value="extension" />
                            <label htmlFor="extension">
                                Add all <code><AsyncValue>{extname(dialog.path)}</AsyncValue></code> files
                            </label>
                            <Field type="radio" id="parent" name="addType" value="parent" />
                            <label htmlFor="parent">
                                Add containing directory <code><AsyncValue>{dirname(dialog.path)}</AsyncValue></code>
                            </label>
                            <Field type="radio" id="custom" name="addType" value="custom" />
                            <label htmlFor="custom">Custom pattern:</label>
                            <span></span>
                            <Field as={StyledInput} name="custom" />
                            <ButtonGroup>
                                <StyledButton type="submit">Add</StyledButton>
                                <StyledButton type="reset">Cancel</StyledButton>
                            </ButtonGroup>
                        </AddIgnoreItemDialog>
                    </Form>
                )}
            </Formik>
        </Modal>
    ) : (
        <></>
    );
};
