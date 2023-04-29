import React, { useEffect } from "react";
import { DialogState, useDialog } from "../../model/state/dialogs";
import { Logger } from "../../util/logger";

type ModalDialogProps = React.ComponentProps<'dialog'> & {
    for: DialogState['type']
}

export const ModalDialog: React.FC<ModalDialogProps> = (props) => {
    const ref = React.useRef<HTMLDialogElement>(null);
    const dialogState = useDialog();

    useEffect(() => {
        if (dialogState.type === props.for) {
            Logger().silly('ModalDialog', 'Showing modal dialog', {
                type: props.for
            });
            ref.current?.showModal();
        }
        return () => {
            ref.current?.close();
        };
    }, [dialogState.type, props.for]);

    return (
        <dialog {...props} ref={ref}>
            {props.children}
        </dialog>
    )
}