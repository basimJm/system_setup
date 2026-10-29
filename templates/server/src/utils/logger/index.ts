import pino, { type DestinationStream, type Logger } from 'pino';
import { SERVICE_NAME } from '../../constants/logging';
import type { LogLevel } from '../../constants/env';
import { redactSensitive } from './redact';

export type { Logger } from 'pino';

export interface LoggerOptions {
  readonly level: LogLevel;
  /** Defaults to stdout; tests pass an in-memory stream. */
  readonly destination?: DestinationStream;
}

/** Structured JSON logger. Every log object passes through `redactSensitive`. */
export const createLogger = ({ level, destination }: LoggerOptions): Logger => {
  const options = {
    level,
    base: { service: SERVICE_NAME },
    formatters: { log: redactSensitive },
    serializers: { err: pino.stdSerializers.err },
  };
  return destination ? pino(options, destination) : pino(options);
};
