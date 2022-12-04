import { invoke } from "@tauri-apps/api";

type Level = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
/**
 * Log wrapper for default winston logger requiring a
 * context where the log message occured
 */
class LogWrapper {
    silly(context: string, message: string, meta?: any) {
        sendLog('TRACE', context, message, meta);
    }

    debug(context: string, message: string, meta?: any) {
        sendLog('DEBUG', context, message, meta);
    }

    info(context: string, message: string, meta?: any) {
        sendLog('INFO', context, message, meta);
    }

    warn(context: string, message: string, meta?: any) {
        sendLog('WARN', context, message, meta);
    }

    error(context: string, message: string, meta?: any) {
        sendLog('ERROR', context, message, meta);
    }
}

function sendLog(level: Level, context: string, message: string, meta: any)
{
    console.log("Sending log message to backend", level, context, message, meta);
    invoke('send_log', { level, context, message, meta });
}

let _logger: LogWrapper;

export const Logger = (): LogWrapper => _logger ?? (initLogging(), _logger);

export function initLogging(): void {
    _logger = new LogWrapper();
}
