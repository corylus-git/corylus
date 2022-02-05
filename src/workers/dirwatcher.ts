import { wrap, proxy } from 'comlink';
import React from 'react';

import { useRepo } from '../model/state/repo';
import { Logger } from '../util/logger';

const fileWatcherWorkerEndpoint = new Worker(new URL('./dirwatcher.worker.ts', import.meta.url));
Logger().info('dirwatcher', 'Starting directory watcher worker');

export const fileWatcherWorker = wrap<typeof import('./dirwatcher.worker').FileWatcherWorker>(
    fileWatcherWorkerEndpoint
);

export function useDirWatcher(repoPath: string): void {
    const repo = useRepo();
    const callback = () => {
        Logger().debug('useDirWatcher', 'Repository changed, reloading status');
        repo.getStatus();
    };
    React.useEffect(() => {
        if (repoPath !== '') {
            fileWatcherWorker.watchDir(repoPath, proxy(callback));
        }
        return () => {
            fileWatcherWorker.unwatchDir();
        };
    }, [repoPath]);
}
