export const SDK_NAME = '__SYSTEM_SLUG__-__SDK_KIND__';

/** Adapter names every kind offers; production refuses both. */
export const FAKE_PROVIDER = 'fake';
export const MEMORY_PROVIDER = 'memory';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
  jitterRatio: 0.2,
} as const;
export const MAX_RETRY_ATTEMPTS = 10;

export const REDACTED = '[redacted]';
export const SECRET_KEY_PATTERN =
  /secret|password|token|credential|authorization|signature|private.?key|api.?key|code$/i;
export const REDACT_MAX_DEPTH = 5;

export const MS_PER_SECOND = 1_000;
