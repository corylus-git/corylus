import { expose } from 'comlink';
import chokidar from 'chokidar';
import { Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { Logger } from '../util/logger';
import { repoStore } from '../model/state/repo';

let repoPath: string | undefined;
let watcher: chokidar.FSWatcher | undefined = undefined;
let interval: number | undefined = undefined;
let subscription: any;

function watchDir(rp: string, changed: () => void): void {
    repoPath = rp;
    try {
        Logger().debug('dirWatcher', `Setting up directory watcher for ${repoPath}`);
        const subj = new Subject<any>();
        watcher = chokidar
            .watch(repoPath, {
                ignored: (p: string) => ['.git'].some((s) => p.includes(s)),
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
                changed();
            });
    } catch (e) {
        Logger().error('dirWatcher', 'Could not initialize directory watcher.', {
            error: e,
        });
        Logger().debug('dirWatcher', 'Falling back to polling');
        interval = window.setInterval(() => repoStore.getState().getStatus(), 60_000);
    }
}

function unwatchDir(): void {
    Logger().debug('dirWatcher', `Disabling directory watcher for ${repoPath}`);
    subscription.unsubscribe();
    watcher?.close();
    interval && clearInterval(interval);
}

export const FileWatcherWorker = {
    watchDir,
    unwatchDir,
};

expose(FileWatcherWorker);
