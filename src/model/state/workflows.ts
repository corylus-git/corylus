import create from 'zustand';

export interface IGitWorkflow {
    readonly isConfigured: boolean;
    readonly name: string;
    currentMenu(): Electron.MenuItemConstructorOptions[];
}

export type Workflows = {
    workflows: readonly IGitWorkflow[];
};

export type WorkflowActions = {
    registerGitWorkflows: (workflows: readonly IGitWorkflow[]) => Promise<void>;
};

export const useWorkflows = create<Workflows & WorkflowActions>((set) => ({
    workflows: [],
    registerGitWorkflows: (workflows: readonly IGitWorkflow[]): Promise<void> => {
        set((state) => ({
            ...state,
            workflows: workflows,
        }));
        return Promise.resolve();
    },
}));
