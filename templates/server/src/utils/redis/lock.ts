import { randomInt, randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import {
  LOCK_DEFAULT_RETRY_ATTEMPTS,
  LOCK_DEFAULT_RETRY_DELAY_MS,
  LOCK_DEFAULT_TTL_MS,
  LOCK_RETRY_JITTER_MS,
  REDIS_OK_REPLY,
} from '../../constants/redis';
import { ConflictError } from '../errors';

export interface LockOptions {
  /** The lock frees itself after this long, so a crashed holder cannot block others forever. */
  readonly ttlMs?: number;
  /** How many times to try before giving up (1 = a single attempt). */
  readonly attempts?: number;
  readonly retryDelayMs?: number;
}

export interface Lock {
  readonly key: string;
  /** Frees the lock only if this holder still owns it. Returns false when it already expired or was taken over. */
  release(): Promise<boolean>;
  /** Resets the TTL only if this holder still owns the lock. */
  extend(ttlMs: number): Promise<boolean>;
}

// Compare-and-act scripts: another holder's lock is never touched.
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end
return 0`;
const EXTEND_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) end
return 0`;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const makeLock = (redis: Redis, key: string, token: string): Lock => ({
  key,
  release: async () => (await redis.eval(RELEASE_SCRIPT, 1, key, token)) === 1,
  extend: async (ttlMs) => (await redis.eval(EXTEND_SCRIPT, 1, key, token, ttlMs)) === 1,
});

/** Takes the lock (`SET NX PX`), retrying with jitter. Resolves `null` when it stays busy. */
export const acquireLock = async (
  redis: Redis,
  key: string,
  {
    ttlMs = LOCK_DEFAULT_TTL_MS,
    attempts = LOCK_DEFAULT_RETRY_ATTEMPTS,
    retryDelayMs = LOCK_DEFAULT_RETRY_DELAY_MS,
  }: LockOptions = {},
): Promise<Lock | null> => {
  const token = randomUUID();
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if ((await redis.set(key, token, 'PX', ttlMs, 'NX')) === REDIS_OK_REPLY)
      return makeLock(redis, key, token);
    if (attempt < attempts) await sleep(retryDelayMs + randomInt(0, LOCK_RETRY_JITTER_MS));
  }
  return null;
};

/**
 * Runs `task` while holding the lock and always releases it. When the lock stays busy it throws
 * `busyError` (default: a 409 `ConflictError`), so callers pick the domain code, e.g. `SLOT_TAKEN`.
 */
export const withLock = async <T>(
  redis: Redis,
  key: string,
  task: (lock: Lock) => Promise<T>,
  options: LockOptions & { readonly busyError?: () => Error } = {},
): Promise<T> => {
  const { busyError = () => new ConflictError(), ...lockOptions } = options;
  const lock = await acquireLock(redis, key, lockOptions);
  if (lock === null) throw busyError();
  try {
    return await task(lock);
  } finally {
    await lock.release();
  }
};

/**
 * Runs `task` while holding every lock in `keys`. Keys are de-duplicated and always taken in
 * sorted order, so two callers that need overlapping sets can never wait for each other forever.
 */
export const withLocks = <T>(
  redis: Redis,
  keys: readonly string[],
  task: () => Promise<T>,
  options: LockOptions & { readonly busyError?: () => Error } = {},
): Promise<T> =>
  [...new Set(keys)]
    .sort()
    .reduceRight<() => Promise<T>>(
      (next, key) => () => withLock(redis, key, next, options),
      task,
    )();
