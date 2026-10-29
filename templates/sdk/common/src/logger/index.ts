import { REDACTED, REDACT_MAX_DEPTH, SECRET_KEY_PATTERN } from '../constants/defaults';

export type LogFields = Readonly<Record<string, unknown>>;
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** Copies `value` with every secret-looking field replaced; the input is never mutated. */
export const redact = (value: unknown, depth = 0): unknown => {
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value !== 'object' || value === null) return value;
  if (depth > REDACT_MAX_DEPTH) return REDACTED;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? REDACTED : redact(item, depth + 1),
    ]),
  );
};

/** Wraps a consumer logger so nothing secret-looking ever reaches it. */
export const redactingLogger = (inner: Logger): Logger => {
  const wrap =
    (level: keyof Logger) =>
    (message: string, fields?: LogFields): void => {
      inner[level](message, fields === undefined ? undefined : (redact(fields) as LogFields));
    };
  return { debug: wrap('debug'), info: wrap('info'), warn: wrap('warn'), error: wrap('error') };
};
