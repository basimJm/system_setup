import { REDIS_KEY_PREFIX, REDIS_KEY_SEPARATOR } from '../../constants/redis';

type KeyPart = string | number;

/**
 * Builds `prefix:part:part`. The prefix is a trusted constant (it may contain separators such as
 * `otp:req`); parts come from users or data, so empty parts and separators inside them are rejected
 * and two different subjects can never collide.
 */
export const redisKey = (prefix: string, ...parts: KeyPart[]): string => {
  if (parts.length === 0) throw new Error('a redis key needs at least one part');
  const texts = parts.map(String);
  for (const text of texts) {
    if (text === '' || text.includes(REDIS_KEY_SEPARATOR)) {
      throw new Error(`invalid redis key part: "${text}"`);
    }
  }
  return [prefix, ...texts].join(REDIS_KEY_SEPARATOR);
};

/** e.g. `lockKey('staff', staffId, '2026-10-12')` → `lock:staff:<id>:2026-10-12`. */
export const lockKey = (...parts: KeyPart[]): string => redisKey(REDIS_KEY_PREFIX.lock, ...parts);
