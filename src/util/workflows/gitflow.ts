import { Logger } from '../logger';
import fs from 'fs';
import path from 'path';
import { toast } from 'react-toastify';
import { IGitFlowConfigValues } from '../../model/IGitConfig';
import { just, Maybe, nothing, fromNullable } from '../maybe';
import { DialogActions } from '../../model/state/dialogs';
import { repoStore } from '../../model/state/repo';
import { IGitWorkflow } from '../../model/state/workflows';

export type InitializeGitflow = {
    type: 'initialize-gitflow';
    config: IGitFlowConfigValues;
};

export type RequestInitializeGitflow = {
    type: 'request-initialize-gitflow';
};

type GitflowBranchType = 'feature' | 'bugfix' | 'release' | 'hotfix';

export type GitflowCommands = InitializeGitflow;

export class Gitflow implements IGitWorkflow {
    get isConfigured(): boolean {
        Logger().silly('GitFlow', 'Checking whether Gitflow is already configured', {
            isConfigured: this.config.found,
        });
        return this.config.found;
    }

    name = 'Gitflow';

    constructor(private dialog: DialogActions) {}

    private get possibleSources(): readonly {
        type: GitflowBranchType;
        base: string;
        prefix: string;
    }[] {
        if (this.config.found) {
            return [
                {
                    type: 'feature',
                    base: this.config.value.branch.develop,
                    prefix: this.config.value.prefix.feature,
                },
                {
                    type: 'bugfix',
                    base: this.config.value.branch.develop,
                    prefix: this.config.value.prefix.bugfix,
                },
                {
                    type: 'release',
                    base: this.config.value.branch.develop,
                    prefix: this.config.value.prefix.release,
                },
                {
                    type: 'hotfix',
                    base: this.config.value.branch.master,
                    prefix: this.config.value.prefix.hotfix,
                },
            ];
        }
        return [];
    }

    currentMenu(): Electron.MenuItemConstructorOptions[] {
        if (!this.isConfigured) {
            return [
                {
                    label: 'Initialize Gitflow',
                    click: (): void => {
                        this.dialog.open({ type: 'request-initialize-gitflow' });
                    },
                },
            ];
        }
        const gitflowMenu: Electron.MenuItemConstructorOptions[] = this.possibleSources.map(
            ({ type, base, prefix }) => {
                return {
                    label: `Start new ${type}`,
                    click: () => startBranch(this.dialog, type, base, prefix),
                };
            }
        );
        return gitflowMenu.concat(this.getAdditionalEntries());
    }

    private getAdditionalEntries(): Electron.MenuItemConstructorOptions[] {
        const repo = repoStore.getState();
        const entries = this.possibleSources.flatMap(({ type, base, prefix }) => {
            if (repo.branches.find((b) => b.current)?.ref.startsWith(prefix)) {
                return [
                    {
                        label: `Finish ${type}`,
                        click: () => finishBranch(type, base),
                    },
                ];
            }
            return [];
        });
        const sep: Electron.MenuItemConstructorOptions = { type: 'separator' };
        return entries.length > 0 ? [sep].concat(entries) : [];
    }

    private get config(): Maybe<IGitFlowConfigValues> {
        const local = repoStore.getState().config.local;
        return local?.gitFlow ? just(local.gitFlow) : nothing;
    }
}

export const configure = async (config: IGitFlowConfigValues): Promise<void> => {
    const backend = repoStore.getState().backend;
    Logger().info('GitFlow', 'Initializing Gitflow');
    // set the config
    Logger().info('Gitflow', 'Setting gitflow config', { config: config });
    await backend.setConfigVariable('gitflow.branch.master', config.branch.master);
    await backend.setConfigVariable('gitflow.branch.develop', config.branch.develop);
    await backend.setConfigVariable('gitflow.prefix.feature', config.prefix.feature);
    await backend.setConfigVariable('gitflow.prefix.bugfix', config.prefix.bugfix);
    await backend.setConfigVariable('gitflow.prefix.release', config.prefix.release);
    await backend.setConfigVariable('gitflow.prefix.hotfix', config.prefix.hotfix);
    await backend.setConfigVariable('gitflow.prefix.support', config.prefix.support);
    await backend.setConfigVariable('gitflow.prefix.versiontag', config.prefix.versiontag);
    // get the history in order to decide, whether we can create our branches at all
    const history = await backend.getHistory();
    if (history.length === 0) {
        Logger().info('Gitflow', 'Creating initial commit to attach branches to.');
        // create an empty .gitignore to be able to initialize things
        fs.writeFileSync(path.join(backend.dir, '.gitignore'), '');
        backend.addPath('.gitignore');
        backend.commit('Initial commit');
        // this will have created an initial commit on 'master' -> if the configuration wants to have a different
        //  branch name, rename it
        if (config.branch.master !== 'master') {
            backend.renameBranch('master', config.branch.master);
        }
    }
    // create the two long-lived branches first, if necessary
    const branches = await backend.getBranches();
    if (branches.findIndex((b) => b.ref === config.branch.master) === -1) {
        Logger().info('Gitflow', 'Creating master branch');
        backend.branch(config.branch.master, 'HEAD', true);
    } else {
        Logger().debug('Gitflow', 'Master branch already exists. Not recreating.');
    }
    if (branches.findIndex((b) => b.ref === config.branch.develop) === -1) {
        Logger().info('Gitflow', 'Creating develop branch');
        backend.branch(config.branch.develop, 'HEAD', false);
    } else {
        Logger().debug('Gitflow', 'Develop branch already exists. Checking out.');
        backend.checkout(config.branch.develop);
    }
    repoStore.getState().getConfig();
    toast.success('Successfully set up repository for GitFlow');
};

export const startBranch = async (
    dialog: DialogActions,
    type: string,
    source: string,
    prefix: string
): Promise<void> => {
    Logger().debug('GitFlow', `Starting new ${type} branch`);
    const repo = repoStore.getState();
    const sourceBranch = repo.branches.find((b) => b.ref === source);
    const sourceBehind = sourceBranch?.upstream?.behind ?? 0;
    if (
        sourceBehind > 0 &&
        confirm(`${source} is not up-to-date with its upstream. Pull changes first?`)
    ) {
        await repo.backend.fetch({
            remote: fromNullable(sourceBranch!.upstream?.remoteName),
            branch: just(`${sourceBranch?.upstream?.ref}:${sourceBranch?.ref}`),
            prune: false,
            fetchAll: false,
        });
    }
    dialog.open({
        type: 'request-new-branch',
        subType: 'workflow',
        source: just(source),
        branchPrefix: just(prefix),
    });
};

export const finishBranch = async (type: GitflowBranchType, target: string): Promise<void> => {
    const r = repoStore.getState();
    Logger().debug('GitFlow', `Finishing ${type} branch`);
    if (r.status.length !== 0) {
        Logger().error('GitFlow', `Refusing to finish ${type} with uncommitted changes`);
        toast(
            `Cannot finish ${type} with uncommitted changes. Please either commit or stash them before continuing.`,
            {
                type: 'error',
                autoClose: false,
            }
        );
    } else {
        try {
            const targetBranch = r.branches.find((b) => !b.remote && b.ref === target);
            if (targetBranch && targetBranch.upstream && targetBranch.upstream.behind > 0) {
                Logger().error('GitFlow', 'Target branch is ahead of source. Refusing to merge.');
                toast(
                    `Cannot finish ${type}. The target branch is not up-to-date with its remote, which increases the chances of producing merge conflicts.`
                );
            } else {
                const current = r.branches.find((b) => b.current);
                Logger().silly('GitFlow', 'Attempting to merge', {
                    sourceBranch: current,
                    targeBranch: target,
                });
                Logger().silly('GitFlow', 'Switching to target branch');
                await repoStore.getState().backend.checkout(target);
                Logger().silly('GitFlow', `Merging ${type} into target branch`);
                await repoStore.getState().backend.merge(current!.ref, true);
                Logger().silly('GitFlow', `Deleting ${type} branch`, { source: current });
                await repoStore.getState().backend.deleteBranch(current!, false, true);
                Logger().debug('GitFlow', `Finished ${type}`);
                toast.success(`Finished ${type}.`);
                repoStore.getState().loadBranches();
                repoStore.getState().loadHistory();
                repoStore.getState().getStatus();
            }
        } catch (e) {
            Logger().error('GitFlow', `Failed to finish ${type}`, { error: e.toString() });
            toast.error(`Could not finish ${type}. ${e}`, { autoClose: false });
        }
    }
};
