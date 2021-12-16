import path from 'path';
import chokidar from 'chokidar';
import { Subject } from 'rxjs';
import React from 'react';
import { throttleTime } from 'rxjs/operators';
import { Logger } from '../util/logger';
import { repoStore } from './state/repo';

export function useDirWatcher(repoPath: string): void {
    React.useEffect(() => {
        if (repoPath !== '') {
            let watcher: chokidar.FSWatcher | undefined = undefined;
            let interval: number | undefined = undefined;
            let subscription: any;
            try {
                Logger().debug('dirWatcher', `Setting up directory watcher for ${repoPath}`);
                const subj = new Subject<any>();
                watcher = chokidar
                    .watch(repoPath, {
                        ignored: path.join(repoPath, '.git'),
                    })
                    .on('all', (ev, p) => {
                        Logger().silly('dirWatcher', 'Received event', {
                            type: ev,
                            file: p,
                        });
                        subj.next(p);
                    });
                subscription = subj
                    .pipe(
                        throttleTime(5000, undefined, { leading: true, trailing: true }) // ensure that the callback doesn't fire too often
                    )
                    .subscribe((files) => {
                        Logger().debug('dirWatcher', 'Directory changed. Reloading repo.', {
                            path: repoPath,
                            files: files,
                        });
                        repoStore.getState().getStatus();
                    });
            } catch (e) {
                Logger().error('dirWatcher', 'Could not initialize directory watcher.', {
                    error: e,
                });
                Logger().debug('dirWatcher', 'Falling back to polling');
                interval = setInterval(() => repoStore.getState().getStatus(), 60_000);
            }
            return () => {
                Logger().debug('dirWatcher', `Disabling directory watcher for ${repoPath}`);
                subscription.unsubscribe();
                watcher?.close();
                interval && clearInterval(interval);
            };
        }
    }, [repoPath]);
}
