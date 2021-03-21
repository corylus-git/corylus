import { StateCreator, SetState, GetState, StoreApi } from 'zustand';

export type Middleware<TStore extends Record<string, unknown>> = (
    config: StateCreator<TStore>
) => (set: SetState<TStore>, get: GetState<TStore>, api: StoreApi<TStore>) => TStore;
