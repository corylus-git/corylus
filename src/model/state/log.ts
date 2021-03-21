import { StateCreator, SetState, GetState, StoreApi } from 'zustand';
import { Logger } from '../../util/logger';

// Log every time state is changed
export function log<TStore extends Record<string, unknown>>(config: StateCreator<TStore>) {
    return (set: SetState<TStore>, get: GetState<TStore>, api: StoreApi<TStore>): TStore =>
        config(
            (args) => {
                Logger().silly('state management', 'Old state', { state: get() });
                set(args);
                Logger().silly('state management', 'New state', { state: get() });
            },
            get,
            api
        );
}
