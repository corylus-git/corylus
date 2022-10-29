// import winston from 'winston';
// import Transport from 'winston-transport';
import { RingBuffer } from 'ring-buffer-ts';

// export interface RingBufferOptions extends Transport.TransportStreamOptions {
//     size?: number;
// }

// export class RingBufferTransport extends Transport {
//     private readonly size: number;
//     private readonly ringBuffer: RingBuffer<any>;

//     constructor(options?: RingBufferOptions) {
//         super(options);
//         this.size = options?.size ?? 100;
//         this.ringBuffer = new RingBuffer(this.size);
//     }

//     log(info: any, callback: () => void) {
//         this.ringBuffer.add(info);
//         callback();
//     }

//     getBuffer(): Array<any> {
//         return this.ringBuffer.toArray();
//     }
// }

/**
 * Log wrapper for default winston logger requiring a
 * context where the log message occured
 */
class LogWrapper {
    // logger: winston.Logger;
    // globalContext: string;

    constructor(globalContext: string, logger: any) {
        // this.logger = logger;
        // this.globalContext = globalContext;
    }

    silly(context: string, message: string, meta?: any) {
        // this.logger.silly(message, {
        //     globalContext: this.globalContext,
        //     context: context,
        //     ...meta,
        // });
    }

    debug(context: string, message: string, meta?: any) {
        // this.logger.debug(message, {
        //     globalContext: this.globalContext,
        //     context: context,
        //     ...meta,
        // });
    }

    info(context: string, message: string, meta?: any) {
        // this.logger.info(message, {
        //     globalContext: this.globalContext,
        //     context: context,
        //     ...meta,
        // });
    }

    warn(context: string, message: string, meta?: any) {
        // this.logger.warn(message, {
        //     globalContext: this.globalContext,
        //     context: context,
        //     ...meta,
        // });
    }

    error(context: string, message: string, meta?: any) {
        // this.logger.error(message, {
        //     globalContext: this.globalContext,
        //     context: context,
        //     ...meta,
        // });
    }

    emerg(context: string, message: string, meta?: any) {
        // this.logger.emerg(message, {
        //     globalContext: this.globalContext,
        //     context: context,
        //     ...meta,
        // });
    }
}

let _logger: LogWrapper;

export const Logger = (): LogWrapper => _logger ?? (initLogging('unknown', 'info'), _logger);

// let _ringBuffer: RingBufferTransport;

// export const LogBuffer = () => _ringBuffer;

export function initLogging(
    globalContext: string,
    level: 'info' | 'debug' | 'silly',
    stdout?: boolean
): void {
    // _ringBuffer = new RingBufferTransport({
    //     level: level,
    //     size: level === 'info' ? 200 : level === 'debug' ? 1000 : 2000,
    // });
    // const transports: Transport[] = [_ringBuffer];
    // TODO
    // (level === 'debug' || level === 'silly') &&
    //     transports.push(
    //         new winston.transports.Console({
    //             level: level,
    //             format: winston.format.prettyPrint(),
    //         })
    //     );
    // stdout &&
    //     transports.push(
    //         new winston.transports.Stream({
    //             stream: process.stdout,
    //             level: level,
    //             format: winston.format.prettyPrint(),
    //         })
    //     );
    _logger = new LogWrapper(
        globalContext,
        // winston.createLogger({
        //     format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        //     transports: transports,
        // })
        undefined
    );
}
