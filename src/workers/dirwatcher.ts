import { proxy, wrap } from 'comlink';
import React from 'react';

import { useRepo } from '../model/state/repo';
import { Logger } from '../util/logger';

const dirwatcherEndpoint = new Worker(new URL('./dirwatcher.worker.ts', import.meta.url));
const dirwatcher = wrap<typeof import('./dirwatcher.worker').FileWatcherWorker>(dirwatcherEndpoint);

export function useDirWatcher(repoPath: string): void {
    const repo = useRepo();
    const callback = () => {
        Logger().debug('useDirWatcher', 'Repository changed, reloading status');
        repo.getStatus();
    };
    React.useEffect(() => {
        if (repoPath !== '') {
            dirwatcher?.watchDir(repoPath, proxy(callback));
        }
        return () => {
            dirwatcher?.unwatchDir();
        };
    }, [repoPath, dirwatcher]);
}
