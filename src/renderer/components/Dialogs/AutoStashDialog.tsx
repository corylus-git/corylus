import React from 'react';

import { StyledDialog } from '../util/StyledDialog';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';
import { AutoStash, DialogActions, useDialog } from '../../../model/state/dialogs';
import { changeBranch } from '../../../model/actions/repo';
import { Logger } from '../../../util/logger';

async function doChange(dialog: AutoStash & DialogActions, autoStash: boolean) {
    Logger().debug('AutoStashDialog', `Stash was ${autoStash ? '' : 'not'} requested.`);
    await changeBranch(dialog.target, !autoStash, autoStash);
    dialog.close();
}

export const AutoStashDialog: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'auto-stash' ? (
        <Modal isOpen={true}>
            <StyledDialog>
                <form>
                    <div>
                        The working directory contains uncommitted changes. Stash changes and
                        re-apply after checkout?
                    </div>
                    <ButtonGroup>
                        <StyledButton onClick={() => doChange(dialog, true)}>
                            Stash and re-apply changes
                        </StyledButton>
                        <StyledButton onClick={() => doChange(dialog, false)}>
                            Ignore changes
                        </StyledButton>
                        <StyledButton onClick={() => dialog.close()}>Cancel</StyledButton>
                    </ButtonGroup>
                </form>
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
