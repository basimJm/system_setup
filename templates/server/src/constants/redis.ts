/** Redis client, key and lock constants. */
export const REDIS_CONNECT_TIMEOUT_MS = 5_000;
export const REDIS_COMMAND_TIMEOUT_MS = 5_000;
export const REDIS_MAX_RETRIES_PER_REQUEST = 3;
export const REDIS_RETRY_BASE_DELAY_MS = 100;
export const REDIS_RETRY_MAX_DELAY_MS = 3_000;
export const REDIS_READINESS_CHECK_NAME = 'redis';
export const REDIS_PING_REPLY = 'PONG';
/** Reply of `SET` when it was applied (`NX` not blocked). */
export const REDIS_OK_REPLY = 'OK';

/** Every key the server writes starts with one of these prefixes. */
export const REDIS_KEY_PREFIX = {
  lock: 'lock',
  /** Shared HTTP rate-limit counters (one sub-prefix per limiter). */
  httpRateLimit: 'rate:http',
  settings: 'settings',
} as const;
export const REDIS_KEY_SEPARATOR = ':';
/** Added to a limiter's counter prefix to name its block flag when no `blockPrefix` is given. */
export const LIMITER_BLOCK_SEGMENT = 'block';

/** Distributed lock defaults (`utils/redis/lock.ts`); callers may pass their own TTL. */
export const LOCK_DEFAULT_TTL_MS = 10_000;
export const LOCK_DEFAULT_RETRY_ATTEMPTS = 20;
export const LOCK_DEFAULT_RETRY_DELAY_MS = 50;
export const LOCK_RETRY_JITTER_MS = 25;
