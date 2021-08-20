import fs from 'fs';
import { Subject } from 'rxjs';
import React from 'react';
import { throttleTime } from 'rxjs/operators';
import { Logger } from '../util/logger';
import { repoStore } from './state/repo';

export function useDirWatcher(path: string): void {
    React.useEffect(() => {
        if (path !== '') {
            if (process.platform === 'win32') {
                Logger().warn(
                    'dirWatcher',
                    'Disabling dir watcher on  windows, as there are performance issues still unresolved.'
                );
                return;
            }
            Logger().debug('dirWatcher', `Setting up directory watcher for ${path}`);
            const subj = new Subject<any>();
            let watcher: fs.FSWatcher | undefined = undefined;
            let interval: number | undefined = undefined;
            try {
                watcher = fs.watch(path, (eventType, filename) => {
                    Logger().silly('dirWatcher', 'Received event', {
                        type: eventType,
                        file: filename,
                    });
                    subj.next(filename);
                });
            } catch (e) {
                Logger().error('dirWatcher', 'Could not initialize directory watcher.', {
                    error: e,
                });
                Logger().debug('dirWatcher', 'Falling back to polling');
                interval = setInterval(() => repoStore.getState().getStatus(), 60_000);
            }
            const subscription = subj
                .pipe(
                    throttleTime(5000, undefined, { leading: true, trailing: true }) // ensure that the callback doesn't fire too often
                )
                .subscribe((files) => {
                    Logger().debug('dirWatcher', 'Directory changed. Reloading repo.', {
                        path: path,
                        files: files,
                    });
                    repoStore.getState().getStatus();
                });
            return () => {
                Logger().debug('dirWatcher', `Disabling directory watcher for ${path}`);
                subscription.unsubscribe();
                watcher?.close();
                interval && clearInterval(interval);
            };
        }
    }, [path]);
}
