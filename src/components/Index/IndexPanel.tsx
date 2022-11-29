import * as React from 'react';
import styled from 'styled-components';
import { Formik, Form, Field } from 'formik';
import mime from 'mime-types';

import { Splitter } from '../util/Splitter';
import { Commit, IndexStatus } from '../../model/stateObjects';
import { StagingArea } from './StagingArea';
import { StyledButton } from '../util/StyledButton';
import { StagingDiffPanel } from './StagingDiffPanel';
import { ConflictResolutionPanel } from '../Merging/ConflictResolutionPanel';
import { Logger } from '../../util/logger';
import { nothing, just, Maybe } from '../../util/maybe';
import { commit, addDiff, continueRebase } from '../../model/actions/repo';
import {
    useRepo,
    usePendingCommit,
    repoStore,
    useRebaseStatus,
} from '../../model/state/repo';
import { useStagingArea } from '../../model/state/stagingArea';
import { ImageDiff } from '../Diff/ImageDiff';
import { isSupportedImageType } from '../../util/filetypes';
import { invoke } from '@tauri-apps/api';
import { useIndex } from '../../model/state';

let splitterX: string | undefined = undefined;

const DiffDisplayPanel: React.FC = () => {
    const stagingArea = useStagingArea();
    if (stagingArea.selectedFile.found) {
        const source = stagingArea.selectedFile.value.source;
        // const fileType = mime.lookup(stagingArea.selectedFile.value.path) || 'text/plain';
        const fileType = 'text/plain';
        if (isSupportedImageType(fileType)) {
            return (
                <div>
                    <h1 style={{ fontSize: '150%' }}>
                        {stagingArea.selectedFile.value.path} @
                        {source === 'workdir' ? 'Working directory' : 'Index'}
                    </h1>
                    <ImageDiff
                        newPath={stagingArea.selectedFile.value.path}
                        newRef={source}
                        oldPath={stagingArea.selectedFile.value.path}
                        oldRef="HEAD"
                    />
                </div>
            );
        }
        return (
            <div>
                <StagingDiffPanel
                    file={stagingArea.selectedFile.value}
                    diff={stagingArea.selectedDiff}
                    onAddDiff={(diff, path, source, isIndex) =>
                        addDiff(diff, path, source, isIndex)
                    }
                />
            </div>
        );
    }
    if (stagingArea.selectedConflict.found) {
        return (
            <div>
                <ConflictResolutionPanel
                    conflict={stagingArea.selectedConflict.value}
                    onClose={() => {
                        stagingArea.deselectConflictedFile();
                    }}
                />
            </div>
        );
    }
    return <></>;
};

export const IndexPanel: React.FC = () => {
    const stagingArea = useStagingArea();
    const { data: index } = useIndex();
    Logger().debug('IndexPanel', 'Received new index status', { index: index });

    function showDiff(file: IndexStatus, source: 'workdir' | 'index') {
        stagingArea.deselectConflictedFile();
        stagingArea.loadDiff(source, file.path);
    }

    function showMergeResolutionPanel(file: IndexStatus) {
        stagingArea.deselectDiff();
        stagingArea.selectConflictedFile(file);
    }

    return (
        <div style={{ display: 'grid', gridTemplateRows: '1fr 10rem', marginLeft: '5px' }}>
            <Splitter onMove={(pos) => (splitterX = `${pos}px`)} initialPosition={splitterX}>
                <StagingArea
                    workdir={index?.filter((s) => s.workdirStatus !== 'unmodified')}
                    staged={index?.filter(
                        (s) =>
                            s.indexStatus !== 'untracked' &&
                            s.indexStatus !== 'unmodified' &&
                            !s.isConflicted // only show conflicted files in the work directory. They'll have to be sorted out anyway.
                    )}
                    onStagePath={(path) => invoke('stage', { path: path.path })}
                    onUnstagePath={(path) => invoke('unstage', { path: path.path })}
                    onSelectWorkdirEntry={(entry) => {
                        if (!entry.isConflicted) {
                            if (entry.type !== 'dir') {
                                showDiff(entry, 'workdir');
                            }
                        } else {
                            showMergeResolutionPanel(entry);
                        }
                    }}
                    onSelectIndexEntry={(entry) => {
                        if (!entry.isConflicted && entry.type !== 'dir') {
                            showDiff(entry, 'index');
                        }
                    }}
                />
                <DiffDisplayPanel />
            </Splitter>
            <CommitForm
                onCommit={() => {
                    // reset everything on index change
                    stagingArea.deselectDiff();
                    stagingArea.deselectConflictedFile();
                }}
            />
        </div>
    );
};

const CommitMessage = styled.textarea`
    background-color: var(--input);
    color: var(--foreground);
    width: 100%;
    :first-line {
        font-weight: bold;
        font-style: italic;
    }
`;

let commitMessage: Maybe<string> = nothing;
let savedAmend = false;

function CommitForm(props: { onCommit?: () => void }) {
    const backend = useRepo((s) => s.backend);
    const pendingCommit = usePendingCommit();
    const rebaseStatus = useRebaseStatus();
    let pendingCommitMessage = pendingCommit.found
        ? just(pendingCommit.value.message)
        : commitMessage;
    if (rebaseStatus.found) {
        pendingCommitMessage = just(rebaseStatus.value.message);
    }
    React.useEffect(() => {
        commitMessage = nothing;
        savedAmend = rebaseStatus.found;
    }, [repoStore.getState().path]);
    return (
        <div
            style={{
                height: '100%',
            }}>
            <Formik
                onSubmit={(values, formik) => {
                    if (rebaseStatus.found) {
                        continueRebase();
                    } else {
                        commit(values.commitmsg, values.amend);
                        props.onCommit?.();
                    }
                    formik.resetForm();
                    commitMessage = nothing;
                    savedAmend = false;
                }}
                enableReinitialize
                initialValues={{
                    commitmsg: pendingCommitMessage.found ? pendingCommitMessage.value : '',
                    amend: savedAmend,
                }}
                initialErrors={
                    !pendingCommitMessage ? { commitmsg: 'No commit message supplied' } : {}
                }
                validate={(values) => {
                    const errors: any = {};
                    if (!values.commitmsg || values.commitmsg.length === 0) {
                        errors.commitMessage = 'No commit message supplied';
                    }
                    return errors;
                }}>
                {(formik) => (
                    <Form
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'fit-content(10rem) 1fr',
                            gridTemplateRows: '1fr fit-content(1rem)',
                            gridGap: '1rem',
                            padding: '0.5rem',
                            height: '100%',
                            boxSizing: 'border-box',
                        }}>
                        <label htmlFor="commitmsg">Commit Message</label>
                        <Field
                            as={CommitMessage}
                            disabled={rebaseStatus.found}
                            id="commitmsg"
                            name="commitmsg"
                            onChange={(ev: any) => {
                                formik.handleChange(ev);
                                commitMessage = just(ev.target.value);
                            }}
                        />
                        <div style={{ gridColumn: 2, marginLeft: 'auto' }}>
                            <Field
                                type="checkbox"
                                id="amend"
                                name="amend"
                                disabled={rebaseStatus.found}
                                onChange={(ev: any) => {
                                    formik.handleChange(ev);
                                    savedAmend = ev.target.checked;
                                    if (!formik.values.amend) {
                                        // this needs to be the "wrong" way around, as we're seeing the value before re-rendering
                                        Logger().debug(
                                            'CommitForm',
                                            'Loading parent commit message to amend commit'
                                        );
                                        getLastCommitMessage()
                                            .then((msg) => {
                                                formik.setFieldValue('commitmsg', msg);
                                                commitMessage = just(msg);
                                            });
                                    }
                                    else {
                                        formik.setFieldValue('commitmsg', '');
                                    }
                                }}
                            />
                            <label htmlFor="amend" style={{ marginRight: '1rem' }}>
                                Amend latest commit
                            </label>
                            <StyledButton type="submit" disabled={!formik.isValid}>
                                {rebaseStatus.found ? 'Continue rebase' : 'Commit'}
                            </StyledButton>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
}

async function getLastCommitMessage(): Promise<string> {
    try {
        Logger().debug('getLastCommitMessage', 'Trying to retrieve the last commit message');
        const commit = await invoke<Commit>('get_commit', { refNameOrOid: "HEAD" });
        return commit.message;
    }
    catch (e) {
        Logger().error(
            'CommitForm',
            'Could not retrieve parent commit message.',
            { error: e }
        )
    }
    return "";
}