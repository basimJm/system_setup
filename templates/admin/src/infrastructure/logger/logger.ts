import { LOG_LEVEL_RANK, type LogLevel } from '@/constants/logging';
import { redact } from './redact';

export type LogSink = (
  level: Exclude<LogLevel, 'silent'>,
  message: string,
  context?: unknown,
) => void;

export interface Logger {
  debug: (message: string, context?: unknown) => void;
  info: (message: string, context?: unknown) => void;
  warn: (message: string, context?: unknown) => void;
  error: (message: string, context?: unknown) => void;
}

/** The only place that talks to `console` (lint forbids it elsewhere). */
export const consoleSink: LogSink = (level, message, context) => {
  // eslint-disable-next-line no-console
  if (context === undefined) console[level](message);
  // eslint-disable-next-line no-console
  else console[level](message, context);
};

export function createLogger(level: LogLevel, sink: LogSink = consoleSink): Logger {
  const enabled = (l: Exclude<LogLevel, 'silent'>) => LOG_LEVEL_RANK[l] >= LOG_LEVEL_RANK[level];
  const log =
    (l: Exclude<LogLevel, 'silent'>) =>
    (message: string, context?: unknown): void => {
      if (enabled(l)) sink(l, message, context === undefined ? undefined : redact(context));
    };
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}
