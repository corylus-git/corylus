import React from 'react';
import { StyledDialog } from '../util/StyledDialog';
import styled from 'styled-components';
import { Formik, Field, useFormikContext } from 'formik';
import { Modal } from '../util/Modal';
import { StyledInput } from '../util/StyledInput';
import { StyledButton } from '../util/StyledButton';
import { BranchInfo } from '../../model/stateObjects';
import { ButtonGroup } from '../util/ButtonGroup';
import { preNormalize, postNormalize } from '../../util/normalizeRef';
import { createBranch } from '../../model/actions/repo';
import { useDialog } from '../../model/state/dialogs';
import { useBranches, useCurrentBranch } from '../../model/state/repo';

const CreateBranchDialogView = styled(StyledDialog)`
    width: 40rem;
    height: 14rem;
    display: grid;
    grid-template-rows: 2fr repeat(3, 1fr) 2fr;
    grid-template-columns: fit-content(10rem) 1fr;

    .full {
        grid-column: 1/3;
        margin-top: 0.5rem;
    }
`;

function SourceBranchSelection(props: {
    branches?: readonly BranchInfo[];
    value?: string;
    id: string;
    onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
    return (
        (props.branches && (
            <select id={props.id} onChange={props.onChange} value={props.value}>
                {/* {props.branches
                    .filter((b) => !b.remote)
                    .map((b) => (
                        <option key={b.ref}>{b.ref}</option>
                    ))} */}
            </select>
        )) || <></>
    );
}

export interface DialogProps {
    isOpen?: boolean;
}

const BranchNameInput: React.FC = () => {
    const timer = React.useRef<number>();
    const formik = useFormikContext();
    const [fieldValue, setFieldValue] = React.useState<string | undefined>(
        formik.getFieldProps('branch').value
    );
    const value = React.useRef<string>();

    return (
        <StyledInput
            type="text"
            name="branch"
            placeholder="branch name"
            value={fieldValue}
            autoFocus
            onChange={(ev) => {
                value.current = preNormalize(ev.target.value);
                setFieldValue(value.current);
                formik.setFieldValue('branch', value.current);
                if (timer.current) {
                    clearTimeout(timer.current);
                }
                timer.current = window.setTimeout(() => {
                    timer.current = undefined;
                    value.current = postNormalize(value.current);
                    setFieldValue(value.current);
                    formik.setFieldValue('branch', value.current);
                }, 500);
            }}
        />
    );
};

export const CreateBranchDialog: React.FC = () => {
    const { data: branches } = useBranches();
    const currentBranch = useCurrentBranch();
    const dialog = useDialog();

    if (dialog.type === 'request-new-branch') {
        return (
            <Modal isOpen={true}>
                <Formik
                    initialValues={{
                        from: dialog.source.found
                            ? dialog.source.value
                            : currentBranch
                            ? currentBranch.refName
                            : '',
                        branch: dialog.branchPrefix.found ? dialog.branchPrefix.value : '',
                        checkout: true,
                    }}
                    onSubmit={(values, _) => {
                        createBranch(values.branch, values.from, values.checkout);
                        dialog.close();
                    }}
                    initialErrors={{ branch: 'Missing source' }} // the initial state is not valid
                    validate={(values) => {
                        const errors: any = {};
                        if (!values.from) {
                            errors.from = 'Missing source branch/commit';
                        }
                        if (!values.branch) {
                            errors.branch = 'Missing target branch name';
                        }
                        return errors;
                    }}>
                    {(formik) => {
                        return (
                            <form onSubmit={formik.handleSubmit}>
                                <CreateBranchDialogView>
                                    <h1 className="full">Create new branch</h1>
                                    <label htmlFor="from">Source</label>
                                    {dialog.subType === 'branch' ? (
                                        <SourceBranchSelection
                                            branches={branches?.filter((b) => !b.remote)}
                                            {...formik.getFieldProps('from')}
                                            id="from"
                                        />
                                    ) : (
                                        <StyledInput
                                            type="text"
                                            disabled
                                            {...formik.getFieldProps('from')}
                                            id="from"
                                        />
                                    )}
                                    <label htmlFor="branch">Branch name</label>
                                    <Field name="branch" id="branch" component={BranchNameInput} />
                                    <label htmlFor="checkout" className="full">
                                        <Field name="checkout" id="checkout" type="checkbox" />{' '}
                                        Checkout branch after creation
                                    </label>
                                    <ButtonGroup className="full">
                                        <StyledButton type="submit" disabled={!formik.isValid}>
                                            Create branch
                                        </StyledButton>
                                        <StyledButton onClick={() => dialog.close()}>
                                            Cancel
                                        </StyledButton>
                                    </ButtonGroup>
                                </CreateBranchDialogView>
                            </form>
                        );
                    }}
                </Formik>
            </Modal>
        );
    }
    return <></>;
};
