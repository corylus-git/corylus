import { ModalDialog } from "./ModalDialog";
import { useDialog } from "../../model/state/dialogs";

type ConfirmationDialogProps = {
    title: string,
    message: string,
    onConfirm: () => void,
}

export const ConfirmationDialog = () => {
    const dialog = useDialog();

    return (<ModalDialog for="confirmation-dialog">
        {dialog.type === 'confirmation-dialog' &&
            <>
                <header>
                    <h2>{dialog.title}</h2>
                </header>
                <section>
                    <p>{dialog.message}</p>
                </section>
                <footer>
                    <button onClick={dialog.close}>Cancel</button>
                    <button onClick={() => {
                        dialog.onConfirm();
                        dialog.close();
                    }}>Confirm</button>
                </footer>
            </>
        }
    </ModalDialog>);
};