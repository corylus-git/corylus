import React from "react";

type ConfirmationDialogProps = {
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
}

export const ConfirmationDialog = React.forwardRef<HTMLDialogElement, ConfirmationDialogProps>((props, ref) => (
    <dialog ref={ref}>
        <header>
            <h2>{props.title}</h2>
        </header>
        <section>
            <p>{props.message}</p>
        </section>
        <footer>
            <button onClick={props.onCancel}>Cancel</button>
            <button onClick={props.onConfirm}>Confirm</button>
        </footer>
    </dialog>
));