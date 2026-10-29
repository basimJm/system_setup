export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

export const REDACTED = '[REDACTED]';
export const SENSITIVE_KEY_PATTERN = /pass(word)?|token|secret|otp|authorization|cookie|iban|card/i;
export const MAX_LOG_DEPTH = 5;
