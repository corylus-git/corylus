import { Person } from './stateObjects';

export interface GitConfigValue<T> 
{
    value: T;
    level: 'System' | 'Global' | 'Local';
}

export interface NamedGitConfigValue<T> extends GitConfigValue<T>
{
    name: string;
}

export interface IGitFlowConfigValues {
    branch: {
        master: GitConfigValue<string>;
        develop: GitConfigValue<string>;
    };
    prefix: {
        feature: GitConfigValue<string>;
        bugfix: GitConfigValue<string>;
        release: GitConfigValue<string>;
        hotfix: GitConfigValue<string>;
        support: GitConfigValue<string>;
        versiontag: GitConfigValue<string>;
    };
}

export interface IGitFlowConfig {
    gitflow?: IGitConfigValues;
}

export interface IGitConfigValues {
    user?: {
        name: GitConfigValue<string>;
        email: GitConfigValue<string>;
    }
}

export interface ICorylusConfig {
    corylus?: {
        autoFetchEnabled?: GitConfigValue<boolean>;
        autoFetchInterval?: GitConfigValue<number>;
    };
}

/**
 * The git configuration as handled by the program.
 *
 * We DO NOT handle system-wide configuration here, as this is outside the scope of the software for now.
 * The software is intended for end-users, that would not typically have a need (or the capability) to modify
 * the system configuration anyway.
 */
export type IGitConfig = IGitConfigValues & IGitFlowConfig & ICorylusConfig;

/**
 * The effective values of a config, i.e. the merged values from global and local
 */
export type IEffectiveConfig = IGitConfigValues & IGitFlowConfig & ICorylusConfig;
