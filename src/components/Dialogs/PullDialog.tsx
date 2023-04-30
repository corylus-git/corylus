import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { Formik } from 'formik';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { pull } from '../../model/actions/repo';
import { useDialog } from '../../model/state/dialogs';
import { useRemotes, useBranches, useCurrentBranch } from '../../model/state/repo';
import { Logger } from '../../util/logger';
import { Controller, useForm } from 'react-hook-form';
import { produceWithPatches } from 'immer';
import { BranchInfo, Remote, RemoteMeta } from '../../model/stateObjects';


type FormValues = {
    remote: string,
    remoteBranch: BranchInfo,
    noFF: boolean,
}

const PullConfigForm: React.FC<{
    remotes: readonly RemoteMeta[],
    branches: readonly BranchInfo[],
    currentBranch: BranchInfo,
    onSubmit: (values: FormValues) => void,
    onCancel: () => void
}> = ({ remotes, branches, currentBranch, onSubmit, onCancel }) => {

    const { register, handleSubmit, watch, formState } = useForm({
        defaultValues: {
            remote: currentBranch.remote ?? remotes[0]?.remote,
            remoteBranch: currentBranch,
            noFF: false,
        }
    });

    const selectedRemote = watch('remote');

    return <form onSubmit={handleSubmit(onSubmit)}
        onReset={onCancel}>
        <p>Pull changes from remote into {currentBranch.refName}?</p>
        <p>
            <label>
                Remote:
                <select {...register('remote', { required: true })}>
                    {remotes.map((r) => (
                        <option key={r.remote}>{r.remote}</option>
                    ))}
                </select>
            </label>
        </p>
        <p>
            <label>
                Remote branch:
                <select {...register('remoteBranch', { required: true })}>
                    {branches
                        // filter the branches by the remote selected in the remote dropdown
                        ?.filter((b) => b.remote === selectedRemote)
                        .map((b) => (
                            <option key={b.refName}>{b.refName}</option>
                        ))}
                </select>
            </label>
        </p>
        <p>
            <label>
                <input type="checkbox" {...register('noFF')} />{' '}
                Always create a merge commit (no fast-forward)
            </label>
        </p>
        <ButtonGroup>
            <StyledButton type="submit" disabled={!formState.isValid}>Pull changes</StyledButton>
            <StyledButton type="reset">Cancel</StyledButton>
        </ButtonGroup>
    </form>
}

export const PullDialog: React.FC = () => {
    const dialog = useDialog();
    const currentBranch = useCurrentBranch();
    const remotes = useRemotes();
    const branches = useBranches();

    if (dialog.type !== 'request-pull' || remotes.isLoading || branches.isLoading || currentBranch.isLoading) {
        return <></>; // TODO better loading indicator, maybe in the dialog itself
    }

    Logger().silly('PullDialog', 'Remotes & branches data loaded', { remotes: remotes.data, branches });

    return dialog.type === 'request-pull' ? (
        <Modal isOpen={true}>
            <StyledDialog>
                <PullConfigForm
                    remotes={remotes.data!} branches={branches.data!} currentBranch={currentBranch.data!} onSubmit={(values) => {
                        pull(values.remote, values.remoteBranch.refName, values.noFF);
                    }}
                    onCancel={() => dialog.close()} />
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
