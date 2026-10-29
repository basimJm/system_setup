import type { Redis } from 'ioredis';
import { LIMITER_BLOCK_SEGMENT, REDIS_KEY_SEPARATOR } from '../../constants/redis';
import { MS_PER_SECOND } from '../../constants/time';
import { redisKey } from './keys';
import { deleteKeys, flagTtlMs, readCounter } from './counter';

export interface LimiterConfig {
  /** Key prefix of the hit counter, e.g. `otp:req` (BUSINESS_DOMAIN.md §3.1). */
  readonly counterPrefix: string;
  /**
   * Key prefix of the block flag, e.g. `otp:block`. Limiters that share it share the block (OTP
   * requests and wrong codes). Defaults to `<counterPrefix>:block`; it must differ from `counterPrefix`.
   */
  readonly blockPrefix?: string;
  /** Hits allowed per window. */
  readonly limit: number;
  readonly windowMs: number;
  /**
   * When set, reaching `limit` blocks the subject for this long (the hit that reaches the limit is
   * still allowed). When not set, hits above `limit` are simply denied until the window resets.
   */
  readonly blockMs?: number;
}

export interface LimitDecision {
  /** This hit may go ahead. */
  readonly allowed: boolean;
  /** The subject is blocked now: later hits are denied until `retryAfterMs` has passed. */
  readonly blocked: boolean;
  readonly count: number;
  readonly remaining: number;
  /** Time until the block or window ends. Rounded up to whole seconds by `toRetryAfterSec`. */
  readonly retryAfterMs: number;
}

export interface LimitStatus {
  readonly blocked: boolean;
  readonly count: number;
  readonly retryAfterMs: number;
}

export interface Limiter {
  /** Counts a hit for `subject` and says whether it may go ahead. Atomic across API instances. */
  hit(subject: string): Promise<LimitDecision>;
  /** Looks without counting (e.g. an OTP pre-check). */
  status(subject: string): Promise<LimitStatus>;
  /** Clears the counter and any block (after a successful verification, or an admin unblock). */
  reset(subject: string): Promise<void>;
}

// KEYS[1] counter, KEYS[2] block flag. ARGV: limit, windowMs, blockMs (0 = no block).
// Returns {allowed, count, blocked, retryAfterMs}.
const HIT_SCRIPT = `
local blockTtl = redis.call('pttl', KEYS[2])
if blockTtl > 0 then
  return {0, tonumber(redis.call('get', KEYS[1]) or '0'), 1, blockTtl}
end
local count = redis.call('incr', KEYS[1])
local ttl = redis.call('pttl', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('pexpire', KEYS[1], ARGV[2])
  ttl = tonumber(ARGV[2])
end
local limit = tonumber(ARGV[1])
local blockMs = tonumber(ARGV[3])
if blockMs > 0 then
  if count >= limit then
    redis.call('set', KEYS[2], '1', 'PX', blockMs)
    redis.call('del', KEYS[1])
    return {1, count, 1, blockMs}
  end
  return {1, count, 0, ttl}
end
if count > limit then return {0, count, 0, ttl} end
return {1, count, 0, ttl}`;

const assertPositiveInteger = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
};

export const toRetryAfterSec = (retryAfterMs: number): number =>
  Math.ceil(retryAfterMs / MS_PER_SECOND);

/** Fixed-window limiter with an optional block, kept in Redis so every API instance shares it. */
export const createLimiter = (redis: Redis, config: LimiterConfig): Limiter => {
  assertPositiveInteger('limit', config.limit);
  assertPositiveInteger('windowMs', config.windowMs);
  if (config.blockMs !== undefined) assertPositiveInteger('blockMs', config.blockMs);
  const blockMs = config.blockMs ?? 0;
  const blockPrefix =
    config.blockPrefix ?? `${config.counterPrefix}${REDIS_KEY_SEPARATOR}${LIMITER_BLOCK_SEGMENT}`;
  // One key for both would make the counter's own TTL read as a block.
  if (blockPrefix === config.counterPrefix) {
    throw new Error('blockPrefix must differ from counterPrefix');
  }
  const keys = (subject: string): { counter: string; block: string } => ({
    counter: redisKey(config.counterPrefix, subject),
    block: redisKey(blockPrefix, subject),
  });

  return {
    async hit(subject) {
      const { counter, block } = keys(subject);
      const [allowed = 0, count = 0, blocked = 0, retryAfterMs = 0] = (await redis.eval(
        HIT_SCRIPT,
        2,
        counter,
        block,
        config.limit,
        config.windowMs,
        blockMs,
      )) as number[];
      return {
        allowed: allowed === 1,
        blocked: blocked === 1,
        count,
        remaining: blocked === 1 ? 0 : Math.max(0, config.limit - count),
        retryAfterMs,
      };
    },
    async status(subject) {
      const { counter, block } = keys(subject);
      const [retryAfterMs, count] = await Promise.all([
        flagTtlMs(redis, block),
        readCounter(redis, counter),
      ]);
      return { blocked: retryAfterMs > 0, count, retryAfterMs };
    },
    async reset(subject) {
      const { counter, block } = keys(subject);
      await deleteKeys(redis, counter, block);
    },
  };
};
