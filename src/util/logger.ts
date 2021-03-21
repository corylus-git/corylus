import winston from 'winston';
import Transport from 'winston-transport';
import { RingBuffer } from 'ring-buffer-ts';

export interface RingBufferOptions extends Transport.TransportStreamOptions {
    size?: number;
}

export class RingBufferTransport extends Transport {
    private readonly size: number;
    private readonly ringBuffer: RingBuffer<any>;

    constructor(options?: RingBufferOptions) {
        super(options);
        this.size = options?.size ?? 100;
        this.ringBuffer = new RingBuffer(this.size);
    }

    log(info: any, callback: () => void) {
        this.ringBuffer.add(info);
        callback();
    }

    getBuffer(): Array<any> {
        return this.ringBuffer.toArray();
    }
}

/**
 * Log wrapper for default winston logger requiring a
 * context where the log message occured
 */
class LogWrapper {
    private _logger: winston.Logger;

    constructor(logger: winston.Logger) {
        this._logger = logger;
    }

    silly(context: string, message: string, meta?: any) {
        this._logger.silly(message, { context: context, ...meta });
    }

    debug(context: string, message: string, meta?: any) {
        this._logger.debug(message, { context: context, ...meta });
    }

    info(context: string, message: string, meta?: any) {
        this._logger.info(message, { context: context, ...meta });
    }

    warn(context: string, message: string, meta?: any) {
        this._logger.warn(message, { context: context, ...meta });
    }

    error(context: string, message: string, meta?: any) {
        this._logger.error(message, { context: context, ...meta });
    }

    emerg(context: string, message: string, meta?: any) {
        this._logger.emerg(message, { context: context, ...meta });
    }
}

let _logger: LogWrapper;

export const Logger = (): LogWrapper => _logger ?? (initLogging('info'), _logger);

let _ringBuffer: RingBufferTransport;

export const LogBuffer = () => _ringBuffer;

export function initLogging(level: 'info' | 'debug' | 'silly', stdout?: boolean): void {
    _ringBuffer = new RingBufferTransport({
        level: level,
        size: level === 'info' ? 200 : level === 'debug' ? 1000 : 2000,
    });
    const transports: Transport[] = [_ringBuffer];
    (level === 'debug' || level === 'silly') &&
        transports.push(
            new winston.transports.Console({
                level: level,
                format: winston.format.prettyPrint(),
            })
        );
    stdout &&
        transports.push(
            new winston.transports.Stream({
                stream: process.stdout,
                level: level,
                format: winston.format.prettyPrint(),
            })
        );
    _logger = new LogWrapper(
        winston.createLogger({
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: transports,
        })
    );
}
