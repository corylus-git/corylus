import React from 'react';
import { Modal } from '../util/Modal';
import { StyledDialog } from '../util/StyledDialog';
import { Formik } from 'formik';
import { ButtonGroup } from '../util/ButtonGroup';
import { StyledButton } from '../util/StyledButton';
import { useDialog } from '../../../model/state/dialogs';
import { rebase } from '../../../model/actions/repo';

export const Rebase: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'rebase' ? (
        <Modal isOpen={true}>
            <StyledDialog>
                <p>Rebase current branch to {dialog.target}?</p>
                <div>
                    <ButtonGroup>
                        <StyledButton
                            onClick={async () => {
                                try {
                                    await rebase(dialog.target);
                                } finally {
                                    dialog.close();
                                }
                            }}>
                            Rebase
                        </StyledButton>
                        <StyledButton onClick={() => dialog.close()}>Cancel</StyledButton>
                    </ButtonGroup>
                </div>
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
