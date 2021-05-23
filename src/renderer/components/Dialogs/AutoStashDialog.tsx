import React from 'react';

import { StyledDialog } from '../util/StyledDialog';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';
import { useDialog } from '../../../model/state/dialogs';
import { changeBranch } from '../../../model/actions/repo';

export const AutoStashDialog: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'auto-stash' ? (
        <Modal isOpen={true}>
            <StyledDialog>
                <form
                    onSubmit={() => {
                        (async () => {
                            await changeBranch(dialog.target, false, true);
                            dialog.close();
                        })();
                    }}
                    onReset={() => dialog.close()}>
                    <div>
                        The working directory contains uncommitted changes. Stash changes and
                        re-apply after checkout?
                    </div>
                    <ButtonGroup>
                        <StyledButton type="submit">Stash and re-apply changes</StyledButton>
                        <StyledButton type="submit">Ignore changes</StyledButton>
                        <StyledButton type="reset">Cancel</StyledButton>
                    </ButtonGroup>
                </form>
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
