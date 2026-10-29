import type { Redis } from 'ioredis';
import { REDIS_OK_REPLY } from '../../constants/redis';

// Atomic: the counter and its expiry are set together, so a crash between INCR and EXPIRE can never
// leave an immortal counter. A key that somehow lost its TTL heals on the next hit.
const HIT_SCRIPT = `
local count = redis.call('incr', KEYS[1])
local ttl = redis.call('pttl', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('pexpire', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}`;

export interface WindowHit {
  /** Hits so far in the current window, including this one. */
  readonly count: number;
  /** Milliseconds until the window (and the counter) resets. */
  readonly ttlMs: number;
}

/** Counts one hit in a fixed window that starts at the first hit. */
export const hitWindow = async (
  redis: Redis,
  key: string,
  windowMs: number,
): Promise<WindowHit> => {
  const [count = 0, ttlMs = windowMs] = (await redis.eval(
    HIT_SCRIPT,
    1,
    key,
    windowMs,
  )) as number[];
  return { count, ttlMs };
};

export const readCounter = async (redis: Redis, key: string): Promise<number> =>
  Number((await redis.get(key)) ?? 0);

export const deleteKeys = async (redis: Redis, ...keys: string[]): Promise<void> => {
  if (keys.length > 0) await redis.del(...keys);
};

const FLAG_VALUE = '1';

/** Sets a flag that disappears by itself after `ttlMs` (overwrites an existing flag). */
export const setFlag = async (redis: Redis, key: string, ttlMs: number): Promise<void> => {
  await redis.set(key, FLAG_VALUE, 'PX', ttlMs);
};

/** Milliseconds the flag still lives, or 0 when it is not set. */
export const flagTtlMs = async (redis: Redis, key: string): Promise<number> =>
  Math.max(0, await redis.pttl(key));

export const hasFlag = async (redis: Redis, key: string): Promise<boolean> =>
  (await flagTtlMs(redis, key)) > 0;

export interface Cooldown {
  /** True when this call started the cooldown, i.e. the action may go ahead now. */
  readonly started: boolean;
  /** When not started: how long until the action is allowed again. */
  readonly retryAfterMs: number;
}

/** "Once per period" guard, e.g. OTP resend: only the first caller in each period starts it. */
export const startCooldown = async (
  redis: Redis,
  key: string,
  ttlMs: number,
): Promise<Cooldown> => {
  if ((await redis.set(key, FLAG_VALUE, 'PX', ttlMs, 'NX')) === REDIS_OK_REPLY) {
    return { started: true, retryAfterMs: 0 };
  }
  return { started: false, retryAfterMs: await flagTtlMs(redis, key) };
};
