import React from 'react';
import { Modal } from '../util/Modal';
import { Formik } from 'formik';
import { StyledInput } from '../util/StyledInput';
import { StyledDialog } from '../util/StyledDialog';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { preNormalize, postNormalize } from '../../util/normalizeRef';
import styled from 'styled-components';
import { createTag } from '../../model/actions/repo';
import { useDialog } from '../../model/state/dialogs';

const CreateTagDialogView = styled(StyledDialog)`
    width: 40rem;
    display: grid;
    grid-template-rows: repeat(7, fit-content(1fr));
    h1 {
        margin-bottom: 0;
    }
    textarea {
        background-color: var(--input);
        color: var(--foreground);
    }
`;

export const RequestCreateTagDialog: React.FC = () => {
    const dialog = useDialog();

    const [tagName, setTagName] = React.useState<string>();
    const value = React.useRef<string>();
    const timer = React.useRef<number>();

    return dialog.type === 'request-create-tag' ? (
        <Modal isOpen={true}>
            <Formik
                onSubmit={(values, _) => {
                    createTag(values.tag, dialog.ref, values.message);
                    dialog.close();
                }}
                onReset={() => dialog.close()}
                initialValues={{
                    tag: '',
                    message: '',
                }}
                initialErrors={{ tag: 'Tag name missing' }}
                validate={({ tag }) => {
                    if (!tag) {
                        return {
                            tag: 'Please enter a tag name',
                        };
                    }
                    return {};
                }}>
                {(formik) => (
                    <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
                        <CreateTagDialogView>
                            <h1>Create tag</h1>
                            <p>Create tag at commit {dialog.ref}</p>
                            <label htmlFor="tag">Tag name:</label>
                            <StyledInput
                                id="tag"
                                placeholder="Tag..."
                                autoCorrect='off'
                                {...formik.getFieldProps('tag')}
                                autoFocus
                                value={tagName}
                                onChange={(ev) => {
                                    value.current = preNormalize(ev.target.value);
                                    setTagName(value.current);
                                    formik.setFieldValue('tag', value.current);
                                    if (timer.current) {
                                        clearTimeout(timer.current);
                                    }
                                    timer.current = window.setTimeout(() => {
                                        timer.current = undefined;
                                        value.current = postNormalize(value.current);
                                        setTagName(value.current);
                                        formik.setFieldValue('branch', value.current);
                                    }, 500);
                                }}
                            />
                            <label htmlFor="message">Tag message (optional):</label>
                            <textarea
                                id="message"
                                placeholder="Tag message... (optional)"
                                {...formik.getFieldProps('message')}></textarea>
                            <ButtonGroup>
                                <StyledButton type="submit" disabled={!formik.isValid}>
                                    Create tag
                                </StyledButton>
                                <StyledButton type="reset">Cancel</StyledButton>
                            </ButtonGroup>
                        </CreateTagDialogView>
                    </form>
                )}
            </Formik>
        </Modal>
    ) : (
        <></>
    );
};
