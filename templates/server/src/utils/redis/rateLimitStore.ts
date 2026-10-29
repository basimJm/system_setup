import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import type { Redis } from 'ioredis';
import { hitWindow } from './counter';
import { redisKey } from './keys';

const DECREMENT_SCRIPT = `
local hits = tonumber(redis.call('get', KEYS[1]) or '0')
if hits > 0 then return redis.call('decr', KEYS[1]) end
return 0`;

/**
 * `express-rate-limit` store backed by Redis, so the global per-IP budget is shared by every API
 * instance. Each limiter gets its own `prefix`, e.g. `rate:http:global`.
 */
export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs: number | undefined;

  constructor(
    private readonly redis: Redis,
    prefix: string,
  ) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private keyFor(clientKey: string): string {
    return redisKey(this.prefix, clientKey.replaceAll(':', '_'));
  }

  async increment(clientKey: string): Promise<ClientRateLimitInfo> {
    if (this.windowMs === undefined) throw new Error('RedisRateLimitStore used before init');
    const { count, ttlMs } = await hitWindow(this.redis, this.keyFor(clientKey), this.windowMs);
    return { totalHits: count, resetTime: new Date(Date.now() + ttlMs) };
  }

  async get(clientKey: string): Promise<ClientRateLimitInfo | undefined> {
    const key = this.keyFor(clientKey);
    const [hits, ttlMs] = await Promise.all([this.redis.get(key), this.redis.pttl(key)]);
    if (hits === null) return undefined;
    return { totalHits: Number(hits), resetTime: new Date(Date.now() + Math.max(0, ttlMs)) };
  }

  async decrement(clientKey: string): Promise<void> {
    await this.redis.eval(DECREMENT_SCRIPT, 1, this.keyFor(clientKey));
  }

  async resetKey(clientKey: string): Promise<void> {
    await this.redis.del(this.keyFor(clientKey));
  }
}
