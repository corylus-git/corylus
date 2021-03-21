import React from 'react';
import { StyledDialog } from '../util/StyledDialog';
import { Modal } from '../util/Modal';
import { StyledButton } from '../util/StyledButton';
import { ButtonGroup } from '../util/ButtonGroup';

import { Logger } from '../../../util/logger';
import { dropStash } from '../../../model/actions/repo';
import { useDialog } from '../../../model/state/dialogs';

export const RequestStashDropDialog: React.FC = () => {
    const dialog = useDialog();
    return dialog.type === 'request-stash-drop' ? (
        <Modal isOpen={true}>
            <StyledDialog>
                <div>Delete stash &quot;{dialog.stash.message}&quot; from the repository?</div>
                <ButtonGroup>
                    <StyledButton
                        onClick={() => {
                            dropStash(dialog.stash);
                            dialog.close();
                        }}>
                        Delete
                    </StyledButton>
                    <StyledButton
                        onClick={() => {
                            Logger().debug(
                                'RequestStashApplyDialog',
                                'Canceled stash apply dialog'
                            );
                            dialog.close();
                        }}>
                        Cancel
                    </StyledButton>
                </ButtonGroup>
            </StyledDialog>
        </Modal>
    ) : (
        <></>
    );
};
