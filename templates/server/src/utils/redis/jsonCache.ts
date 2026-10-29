import type { Redis } from 'ioredis';
import type { Logger } from '../logger';

/** Short-lived JSON cache in Redis; a cache failure never fails the caller (the load just runs). */
export type JsonCache = <T>(key: string, load: () => Promise<T>) => Promise<T>;

export const createJsonCache =
  (deps: {
    readonly redis: Pick<Redis, 'get' | 'set'>;
    readonly logger: Logger;
    readonly prefix: string;
    readonly ttlSec: number;
  }): JsonCache =>
  async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const fullKey = `${deps.prefix}:${key}`;
    try {
      const hit = await deps.redis.get(fullKey);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (error) {
      deps.logger.warn({ err: error, prefix: deps.prefix }, 'cache read failed');
    }
    const value = await load();
    try {
      await deps.redis.set(fullKey, JSON.stringify(value), 'EX', deps.ttlSec);
    } catch (error) {
      deps.logger.warn({ err: error, prefix: deps.prefix }, 'cache write failed');
    }
    return value;
  };
