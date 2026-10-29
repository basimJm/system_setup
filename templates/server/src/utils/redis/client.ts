import { Redis, type RedisOptions } from 'ioredis';
import type { AppConfig } from '../../config';
import {
  REDIS_COMMAND_TIMEOUT_MS,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_MAX_RETRIES_PER_REQUEST,
  REDIS_PING_REPLY,
  REDIS_READINESS_CHECK_NAME,
  REDIS_RETRY_BASE_DELAY_MS,
  REDIS_RETRY_MAX_DELAY_MS,
} from '../../constants/redis';
import { withTimeout } from '../async/timeout';
import { ExternalServiceError } from '../errors';
import type { ReadinessCheck } from '../health';
import type { Logger } from '../logger';

/** Exponential backoff with a cap; always retries so a Redis restart heals without a deploy. */
export const redisRetryDelay = (attempt: number): number =>
  Math.min(REDIS_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), REDIS_RETRY_MAX_DELAY_MS);

export const buildRedisOptions = (overrides: RedisOptions = {}): RedisOptions => ({
  lazyConnect: true,
  connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
  commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
  maxRetriesPerRequest: REDIS_MAX_RETRIES_PER_REQUEST,
  retryStrategy: redisRetryDelay,
  ...overrides,
});

/**
 * Opens the shared Redis connection. Use `redis.duplicate()` for subscribers (Socket.IO adapter,
 * BullMQ) because a subscribing connection cannot run normal commands.
 * A failure is logged without the URL and thrown as a typed 503 `ExternalServiceError`.
 */
export const connectRedis = async (
  config: Pick<AppConfig, 'redis'>,
  logger: Logger,
  overrides: RedisOptions = {},
): Promise<Redis> => {
  const redis = new Redis(config.redis.url, buildRedisOptions(overrides));
  redis.on('error', (err: Error) => {
    logger.warn({ err }, 'redis error');
  });
  redis.on('reconnecting', () => {
    logger.warn('redis reconnecting');
  });
  redis.on('ready', () => {
    logger.info('redis ready');
  });
  try {
    await withTimeout(redis.connect(), REDIS_CONNECT_TIMEOUT_MS);
    return redis;
  } catch (error) {
    redis.disconnect();
    logger.error({ err: error }, 'redis connection failed');
    throw new ExternalServiceError({ unavailable: true, cause: error });
  }
};

/** Graceful close: finishes pending commands, falls back to a hard disconnect. */
export const disconnectRedis = async (redis: Redis): Promise<void> => {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
};

/** `/ready` probe: the server answers PING. */
export const createRedisReadinessCheck = (redis: Pick<Redis, 'ping'>): ReadinessCheck => ({
  name: REDIS_READINESS_CHECK_NAME,
  check: async () => {
    const reply: string = await redis.ping();
    if (reply !== REDIS_PING_REPLY) throw new Error('unexpected PING reply');
  },
});
