import React from 'react';
import { RepoActions, RepoState, repoStore} from '../model/state/repo';
import { Logger } from './logger';
import { nothing } from './maybe';

export function useAutoFetcher(repo: RepoState & RepoActions): void {
    const config: any = {};
    console.warn("Autofetcher broken. Move to backend.");
    React.useEffect(() => {
        let timer: number | undefined = undefined;
        if (config.global?.corylus?.autoFetchEnabled) {
            Logger().debug('useAutoFetcher', 'Starting auto fetcher.', {
                interval: config.global.corylus.autoFetchInterval,
            });
            timer = window.setInterval(() => {
                try {
                    Logger().debug('autoFetcher', 'Fetching remotes');
                    repoStore.getState().backend.fetch({
                        fetchTags: true,
                        branch: nothing,
                        prune: true,
                        remote: nothing,
                    });
                } catch (e) {
                    Logger().error('autoFetcher', 'Could not fetch remotes', { error: e });
                }
            }, (config.global.corylus.autoFetchInterval ?? 5) * 60 * 1000);
        }
        return () => {
            if (timer) {
                Logger().debug('useAutoFetcher', 'Stopping auto fetcher.');
                clearInterval(timer);
            }
        };
    }, [repo.path, config]);
}
