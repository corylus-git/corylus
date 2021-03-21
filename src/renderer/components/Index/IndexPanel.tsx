import * as React from 'react';
import { Splitter } from '../util/Splitter';
import { IndexStatus } from '../../../model/stateObjects';

import { StagingArea } from './StagingArea';
import { StyledButton } from '../util/StyledButton';
import { StagingDiffPanel } from './StagingDiffPanel';
import { ConflictResolutionPanel } from '../Merging/ConflictResolutionPanel';
import { Formik, Form, Field } from 'formik';
import { Logger } from '../../../util/logger';
import styled from 'styled-components';
import { nothing, just } from '../../../util/maybe';
import { commit, stage, unstage, addDiff } from '../../../model/actions/repo';
import { useStatus, useRepo, usePendingCommit, repoStore } from '../../../model/state/repo';
import { useStagingArea } from '../../../model/state/stagingArea';

export const IndexPanel: React.FC = () => {
    const stagingArea = useStagingArea();
    const index = useStatus();
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
            <Splitter>
                <StagingArea
                    workdir={index.filter((s) => s.workdirStatus !== 'unmodified')}
                    staged={index.filter(
                        (s) =>
                            s.indexStatus !== 'untracked' &&
                            s.indexStatus !== 'unmodified' &&
                            !s.isConflicted // only show conflicted files in the work directory. They'll have to be sorted out anyway.
                    )}
                    onStagePath={(path) => stage(path)}
                    onUnstagePath={(path) => unstage(path)}
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
                <div>
                    {stagingArea.selectedFile.found && (
                        <StagingDiffPanel
                            file={stagingArea.selectedFile.value}
                            diff={stagingArea.selectedDiff}
                            onAddDiff={(diff, path, source, isIndex) =>
                                addDiff(diff, path, source, isIndex)
                            }
                        />
                    )}
                    {stagingArea.selectedConflict.found && (
                        <ConflictResolutionPanel
                            conflict={stagingArea.selectedConflict.value}
                            onClose={() => {
                                stagingArea.deselectConflictedFile();
                            }}
                        />
                    )}
                </div>
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
    background-color: ${(props) => props.theme.colors.input};
    color: ${(props) => props.theme.colors.foreground};
    width: 100%;
    :first-line {
        font-weight: bold;
        font-style: italic;
    }
`;

function CommitForm(props: { onCommit?: () => void }) {
    const backend = useRepo((s) => s.backend);
    const pendingCommit = usePendingCommit();
    const pendingCommitMessage =
        (pendingCommit.found && just(pendingCommit.value.message)) || nothing;
    return (
        <div
            style={{
                height: '100%',
            }}>
            <Formik
                onSubmit={(values, formik) => {
                    commit(values.commitmsg, values.amend);
                    props.onCommit?.();
                    formik.resetForm();
                }}
                enableReinitialize
                initialValues={{
                    commitmsg: pendingCommitMessage.found ? pendingCommitMessage.value : '',
                    amend: false,
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
                        <Field as={CommitMessage} id="commitmsg" name="commitmsg" />
                        <div style={{ gridColumn: 2, marginLeft: 'auto' }}>
                            <Field
                                type="checkbox"
                                id="amend"
                                name="amend"
                                onChange={(ev: any) => {
                                    formik.handleChange(ev);
                                    if (!formik.values.amend) {
                                        // this needs to be the "wrong" way around, as we're seeing the value before re-rendering
                                        Logger().debug(
                                            'CommitForm',
                                            'Loading parent commit message to amend commit'
                                        );
                                        backend
                                            .getCommit('HEAD')
                                            .then((commit) => {
                                                formik.setFieldValue('commitmsg', commit.message);
                                            })
                                            .catch((e) =>
                                                Logger().error(
                                                    'CommitForm',
                                                    'Could not retrieve parent commit message.',
                                                    { error: e }
                                                )
                                            );
                                    }
                                }}
                            />
                            <label htmlFor="amend" style={{ marginRight: '1rem' }}>
                                Amend latest commit
                            </label>
                            <StyledButton type="submit" disabled={!formik.isValid}>
                                Commit
                            </StyledButton>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
}
