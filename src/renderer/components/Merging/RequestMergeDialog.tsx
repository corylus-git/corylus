import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { Formik } from 'formik';
import { toOptional } from '../../../util/maybe';
import { merge } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';
import { useBranches, useCurrentBranch } from '../../../model/state/repo';

/**
 * Open the merge configuration dialog
 *
 * @param props The properties of the dialog component
 */
export const RequestMergeDialog: React.FC = () => {
    const branches = useBranches();
    const dialog = useDialog();
    const targetBranch = useCurrentBranch();
    if (dialog.type === 'request-merge') {
        const from = dialog.source;
        return (
            <Modal isOpen={true}>
                <Formik
                    initialValues={{
                        from: from.found ? from.value : '',
                        noFF: false,
                    }}
                    onSubmit={(values, { setSubmitting }) => {
                        merge(values.from, values.noFF);
                        dialog.close();
                    }}
                    onReset={() => dialog.close()}>
                    {(formik) => (
                        <StyledDialog>
                            <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
                                {!from && (
                                    <>
                                        <div>
                                            <label htmlFor="from">Merge from branch </label>{' '}
                                            <select id="from" value={from}>
                                                {branches
                                                    .filter((b) => !b.current && !b.remote)
                                                    .map((b) => (
                                                        <option key={b.ref}>{b.ref}</option>
                                                    ))}
                                            </select>{' '}
                                            into {toOptional(targetBranch)?.ref}?
                                        </div>
                                        <div>
                                            <input
                                                type="checkbox"
                                                id="no-ff"
                                                {...formik.getFieldProps('noFF')}
                                            />
                                            <label htmlFor="no-ff">
                                                Always create merge commit (no fast-forward merge)?
                                            </label>
                                        </div>
                                    </>
                                )}
                                {from.found ? (
                                    <>
                                        <input
                                            type="hidden"
                                            id="from"
                                            value={toOptional(targetBranch)?.ref}
                                        />
                                        <div>
                                            Merge from branch {from.value} into{' '}
                                            {toOptional(targetBranch)?.ref}?
                                        </div>
                                        <div>
                                            <input
                                                type="checkbox"
                                                id="no-ff"
                                                {...formik.getFieldProps('noFF')}
                                            />
                                            <label htmlFor="no-ff">
                                                Always create merge commit (no fast-forward merge)?
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <input
                                            type="hidden"
                                            id="from"
                                            value={toOptional(targetBranch)?.ref}
                                        />
                                        Merge from commit {from} into{' '}
                                        {toOptional(targetBranch)?.ref}?
                                    </div>
                                )}
                                <ButtonGroup>
                                    <StyledButton disabled={!formik.isValid} type="submit">
                                        Merge
                                    </StyledButton>
                                    <StyledButton type="reset">Cancel</StyledButton>
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
