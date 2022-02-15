import { toast } from 'react-toastify';
import { Logger } from './logger';
import { structuredToast } from './structuredToast';

export function trackError<P extends unknown[], R>(
    action: string,
    context: string,
    func: (...args: P) => Promise<R>
): (...args: P) => Promise<R> {
    return async (...args: P): Promise<R> => {
        try {
            return await func(...args);
        } catch (e: any) {
            Logger().error(context, `Failed to ${action}`, { error: e });
            toast.error(structuredToast(`Failed to ${action}`, e.toString().split('\n')), {
                autoClose: false,
            });
            throw e;
        }
    };
}
