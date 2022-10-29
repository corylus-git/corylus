import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import styled from 'styled-components';
import { StyledInput } from '../util/StyledInput';
import { Formik, Form, Field } from 'formik';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { useDialog } from '../../model/state/dialogs';
import { configure } from '../../util/workflows/gitflow';

const ConfigureGitFlowView = styled(StyledDialog)`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 0.25rem;

    h1 {
        font-size: 1.5rem;
        margin-top: 0;
    }

    h2 {
        border-bottom: 1px solid var(--border);
        font-size: 1.1rem;
    }

    .full {
        grid-column: 1/3;
    }
`;

export const ConfigureGitFlow: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'request-initialize-gitflow' ? (
        <Modal isOpen={true}>
            <Formik
                onSubmit={(values) => {
                    configure({
                        branch: {
                            master: values.master,
                            develop: values.develop,
                        },
                        prefix: {
                            feature: values.feature,
                            release: values.release,
                            support: values.support,
                            hotfix: values.hotfix,
                            bugfix: values.bugfix,
                            versiontag: values.tags,
                        },
                    });
                    dialog.close();
                }}
                onReset={() => dialog.close()}
                initialValues={{
                    master: 'master',
                    develop: 'develop',
                    feature: 'feature/',
                    release: 'release/',
                    support: 'support/',
                    hotfix: 'hotfix/',
                    bugfix: 'bugfix/',
                    tags: '',
                }}>
                <Form>
                    <ConfigureGitFlowView>
                        <h1 className="full">Initialize git flow</h1>
                        <label htmlFor="master">Production branch (master)</label>
                        <Field as={StyledInput} id="master" name="master" />
                        <label htmlFor="develop">Development branch (develop)</label>
                        <Field as={StyledInput} id="develop" name="develop" />
                        <h2 className="full">Branch prefixes</h2>
                        <label htmlFor="feature">Feature branches</label>
                        <Field as={StyledInput} id="feature" name="feature" />
                        <label htmlFor="release">Release branches</label>
                        <Field as={StyledInput} id="release" name="release" />
                        <label htmlFor="support">Support branches</label>
                        <Field as={StyledInput} id="support" name="support" />
                        <label htmlFor="hotfix">Hotfix branches</label>
                        <Field as={StyledInput} id="hotfix" name="hotfix" />
                        <label htmlFor="bugfix">Bugfix branches</label>
                        <Field as={StyledInput} id="bugfix" name="bugfix" />
                        <h2 className="full">Release tags</h2>
                        <label htmlFor="tags">Release tag prefix</label>
                        <Field as={StyledInput} id="tags" name="tags" />
                        <ButtonGroup className="full">
                            <StyledButton type="submit">Initialize</StyledButton>
                            <StyledButton type="reset">Cancel</StyledButton>
                        </ButtonGroup>
                    </ConfigureGitFlowView>
                </Form>
            </Formik>
        </Modal>
    ) : (
        <></>
    );
};
