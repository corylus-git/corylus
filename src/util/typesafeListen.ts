import { WindowEvents } from '../../src-tauri/bindings/WindowEvents';
import { EventCallback, listen as tauriListen } from '@tauri-apps/api/event';

export function listen<PayloadType = unknown>(ev: WindowEvents, handler: EventCallback<PayloadType>) {
    return tauriListen(ev, handler);
} 