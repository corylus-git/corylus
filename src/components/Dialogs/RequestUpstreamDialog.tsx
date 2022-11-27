import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { Field, Formik } from 'formik';
import { StyledInput } from '../util/StyledInput';
import { Logger } from '../../util/logger';
import { useDialog } from '../../model/state/dialogs';
import { useBranches, useRemotes } from '../../model/state/repo';
import { push } from '../../model/actions/repo';
import { BranchInfo, RemoteMeta, UpstreamInfo } from '../../model/stateObjects';
import { fromNullable, just, Maybe, nothing, toOptional, withDefault } from '../../util/maybe';
import { ExtendableDropDown } from '../shared/ExtendableDropDown';

function selectTargetRemote(
    forBranch: Maybe<string>,
    remotes: readonly RemoteMeta[],
    existingUpstream: Maybe<UpstreamInfo>
): { remote: Maybe<string>; ref: Maybe<string> } {
    if (existingUpstream.found) {
        return {
            remote: fromNullable(existingUpstream.value.remoteName),
            ref: just(existingUpstream.value.ref),
        };
    }
    return {
        remote: (remotes.length ?? 0) > 0 ? just(remotes![0].remote) : nothing,
        ref: forBranch,
    };
}

/**
 * Open the upstream configuration dialog for pushes of branches, that do not have an upstream yet
 */
export const RequestUpstreamDialog: React.FC = () => {
    const dialog = useDialog();
    const remotes = useRemotes();
    const {data: branches} = useBranches();
    if (dialog.type === 'request-upstream') {
        const upstream = selectTargetRemote(
            fromNullable(dialog.forBranch.refName),
            remotes,
            dialog.currentUpstream
        );
        return (
            <Modal isOpen>
                <Formik
                    initialValues={{
                        remote: toOptional(upstream.remote),
                        upstream: withDefault(upstream.ref, ''),
                        pushTags: true
                    }}
                    onSubmit={(values) => {
                        Logger().silly(
                            'RequestUpstreamDialog',
                            'Pushing changes to upstream',
                            {
                                source: dialog.forBranch.refName,
                                remote: values.remote,
                                upstream: values.upstream,
                                pushTags: values.pushTags
                            }
                        );
                        push(
                            dialog.forBranch.refName,
                            values.remote,
                            values.upstream,
                            !dialog.currentUpstream.found, // don't change the existing upstream, if any
                            values.pushTags
                        );
                        dialog.close();
                    }}
                    validate={({ remote, upstream }) => {
                        const errors: any = {};
                        if (!remote) {
                            errors.remote = 'Please select a remote to push to';
                        }
                        if (!upstream) {
                            errors.upstream = 'Please enter a name for the upstream branch';
                        }
                    }}
                    onReset={() => dialog.close()}>
                    {(formik) => (
                        <StyledDialog>
                            <form onSubmit={formik.handleSubmit} onReset={formik.handleReset}>
                                <>
                                    {dialog.currentUpstream.found ? (
                                        <div>Push changes to upstream</div>
                                    ) : (
                                        <div>
                                            Branch {dialog.forBranch.refName} does not have an upstream
                                            branch. Create?
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '7rem 1fr',
                                            alignItems: 'center',
                                            gridGap: '0.5rem',
                                            marginTop: '1rem',
                                        }}>
                                        <label htmlFor="remote">Target remote</label>{' '}
                                        <select id="remote" {...formik.getFieldProps('remote')}>
                                            {remotes?.map((r) => (
                                                <option key={r.remote}>{r.remote}</option>
                                            ))}
                                        </select>
                                        <label htmlFor="upstream">Remote branch </label>
                                        <ExtendableDropDown
                                            {...formik.getFieldProps('upstream')}
                                            onChange={(value) => {
                                                formik.setFieldValue('upstream', value);
                                            }}
                                            options={branches?.filter((b) => b.remote === formik.values.remote)
                                                .map((b) => b.refName) ?? []}
                                        />
                                    </div>
                                    <div>
                                        <Field type="checkbox" name="pushTags" />
                                        <label htmlFor="pushTags">
                                            Push all tags to remote
                                        </label>
                                    </div>
                                </>
                                <ButtonGroup>
                                    <StyledButton disabled={!formik.isValid} type="submit">
                                        Push
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
