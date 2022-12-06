import create from 'zustand/vanilla';
import createHook from 'zustand';

export type ProgressState = {
    message: string;
    animate: boolean;
};

export type ProgressActions = {
    setProgress: (message: string, animate: boolean, timeout?: number) => void;
};

export const progress = create<ProgressState & ProgressActions>(
    (set, get) => ({
        message: '',
        animate: false,
        setProgress: (message: string, animate: boolean, timeout?: number): void => {
            if (timeout !== undefined) {
                setTimeout(() => get().setProgress('', false, undefined), timeout);
            }
            set((_) => ({ message, animate }));
        },
    })
);

export const useProgress = createHook(progress);
