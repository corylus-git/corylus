import { Person } from './stateObjects';
import { Logger } from '../util/logger';

/**
 * A simple git config values
 */
export interface IConfigValues {
    user?: Partial<Person>;
}

/**
 * Retrieve the effective git configuration, i.e. local values overriding global ones
 *
 * @param IGitConfig The git config as retrieved from the system
 */
export function effective(config?: IGitConfig): IConfigValues | undefined {
    const conf = config && {
        ...config.global,
        ...config.local,
    };
    Logger().silly('IGitConfig', 'Effective config', { config: conf });
    return conf;
}

export interface IGitFlowConfigValues {
    branch: {
        master: string;
        develop: string;
    };
    prefix: {
        feature: string;
        bugfix: string;
        release: string;
        hotfix: string;
        support: string;
        versiontag: string;
    };
}
export interface IGitConfigValues {
    /* currently empty by design */
}
export interface IGitFlowConfig {
    gitFlow?: IGitFlowConfigValues;
}

/**
 * The git configuration as handled by the program.
 *
 * We DO NOT handle system-wide configuration here, as this is outside the scope of the software for now.
 * The software is intended for end-users, that would not typically have a need (or the capability) to modify
 * the system configuration anyway.
 */
export interface IGitConfig {
    local?: IGitConfigValues & IGitFlowConfig;
    global?: IGitConfigValues;
}
