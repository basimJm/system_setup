import type { Redis } from 'ioredis';
import { z } from 'zod';
import { ERROR_CODES, errorMessageKey } from '../../constants/errorCodes';
import { REDIS_KEY_PREFIX } from '../../constants/redis';
import {
  SETTINGS_CACHE_KEY_PARTS,
  SETTINGS_CACHE_TTL_SEC,
  SETTINGS_INITIAL_VERSION,
  SETTINGS_REDIS_RETRY_MS,
} from '../../constants/settings';
import { ValidationError } from '../../utils/errors';
import { zodIssuesToDetails } from '../../utils/errors/zodDetails';
import type { Logger } from '../../utils/logger';
import { redisKey } from '../../utils/redis/keys';
import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  isSettingKey,
  type SettingKey,
  type SettingValue,
} from './definitions';

export interface StoredSetting {
  readonly key: string;
  readonly value: unknown;
}

/** Where settings are kept. `SettingsRepository` implements it; tests use an in-memory one. */
export interface SettingsStore {
  findAllEntries(): Promise<readonly StoredSetting[]>;
  upsert(key: string, value: unknown): Promise<unknown>;
}

/** Every setting with its effective value: the saved one, or the default. Read-only. */
export type SettingsSnapshot = { readonly [K in SettingKey]: SettingValue<K> };

export interface SettingsService {
  snapshot(): Promise<SettingsSnapshot>;
  get<K extends SettingKey>(key: K): Promise<SettingValue<K>>;
  /** Validates, saves and returns the value. Every instance sees it at once. */
  set<K extends SettingKey>(key: K, value: unknown): Promise<SettingValue<K>>;
}

export interface SettingsServiceDeps {
  readonly store: SettingsStore;
  readonly redis: Redis;
  readonly logger: Logger;
  readonly cacheTtlSec?: number;
  /** The clock, injectable for tests. */
  readonly now?: () => number;
}

const cachedOverridesSchema = z.array(z.object({ key: z.string(), value: z.unknown() }));

// Writes the cache only if nobody changed a setting since the caller read the version, so a slow
// reader that loaded old data can never put it back after a change.
// KEYS: version, cache. ARGV: expected version, payload, ttl seconds.
const CACHE_IF_VERSION_SCRIPT = `
if (redis.call('get', KEYS[1]) or '${SETTINGS_INITIAL_VERSION}') == ARGV[1] then
  redis.call('set', KEYS[2], ARGV[2], 'EX', ARGV[3])
  return 1
end
return 0`;

/**
 * Platform settings (BUSINESS_DOMAIN.md §3.7, §10). Only changed keys are stored; everything else
 * uses the default. Stored values are cached in Redis for all instances, and a change invalidates
 * the cache for all of them. Redis is an optimisation: when it is unavailable, reads go to the
 * database.
 */
export const createSettingsService = ({
  store,
  redis,
  logger,
  cacheTtlSec = SETTINGS_CACHE_TTL_SEC,
  now = Date.now,
}: SettingsServiceDeps): SettingsService => {
  const overridesKey = redisKey(REDIS_KEY_PREFIX.settings, SETTINGS_CACHE_KEY_PARTS.overrides);
  const versionKey = redisKey(REDIS_KEY_PREFIX.settings, SETTINGS_CACHE_KEY_PARTS.version);
  let redisRetryAt = 0;
  // The snapshot built from the last payload, reused while the payload is identical.
  let memo: { readonly raw: string; readonly snapshot: SettingsSnapshot } | undefined;

  const redisUsable = (): boolean => now() >= redisRetryAt;
  const redisFailed = (): void => {
    redisRetryAt = now() + SETTINGS_REDIS_RETRY_MS;
  };

  const parseOverrides = (raw: string): readonly StoredSetting[] | undefined => {
    try {
      const parsed = cachedOverridesSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  };

  /** Effective settings: a saved value that is unknown or invalid never reaches a caller. */
  const build = (overrides: readonly StoredSetting[]): SettingsSnapshot => {
    const stored = new Map(overrides.map(({ key, value }) => [key, value] as const));
    for (const key of stored.keys()) {
      if (!isSettingKey(key)) logger.warn({ key }, 'ignoring an unknown stored setting');
    }
    const entries = SETTING_KEYS.map((key) => {
      const definition = SETTING_DEFINITIONS[key];
      if (!stored.has(key)) return [key, definition.default] as const;
      const parsed = definition.schema.safeParse(stored.get(key));
      if (parsed.success) return [key, parsed.data] as const;
      logger.warn({ key }, 'ignoring an invalid stored setting, using its default');
      return [key, definition.default] as const;
    });
    return Object.freeze(Object.fromEntries(entries)) as SettingsSnapshot;
  };

  const cacheIfUnchanged = async (version: string, payload: string): Promise<void> => {
    try {
      await redis.eval(
        CACHE_IF_VERSION_SCRIPT,
        2,
        versionKey,
        overridesKey,
        version,
        payload,
        cacheTtlSec,
      );
    } catch (error) {
      redisFailed();
      logger.warn({ err: error }, 'could not cache the settings');
    }
  };

  /** The saved settings as one JSON payload, from the cache or else from the database. */
  const loadOverrides = async (): Promise<{ raw: string; overrides: readonly StoredSetting[] }> => {
    let version: string | undefined;
    if (redisUsable()) {
      try {
        const cached = await redis.get(overridesKey);
        if (cached !== null) {
          const overrides = parseOverrides(cached);
          if (overrides !== undefined) return { raw: cached, overrides };
          logger.warn('ignoring a corrupt settings cache entry');
        }
        // Read before the database, so a change made in between invalidates this load.
        version = (await redis.get(versionKey)) ?? SETTINGS_INITIAL_VERSION;
      } catch (error) {
        redisFailed();
        logger.warn({ err: error }, 'settings cache unavailable, reading the database');
      }
    }
    const stored = await store.findAllEntries();
    const overrides = stored.map(({ key, value }) => ({ key, value }));
    const raw = JSON.stringify(overrides);
    if (version !== undefined) await cacheIfUnchanged(version, raw);
    return { raw, overrides };
  };

  const snapshot = async (): Promise<SettingsSnapshot> => {
    const { raw, overrides } = await loadOverrides();
    if (memo?.raw === raw) return memo.snapshot;
    const built = build(overrides);
    memo = { raw, snapshot: built };
    return built;
  };

  /** Drops the cache for every instance: the version moves on and the payload goes. */
  const invalidate = async (): Promise<void> => {
    if (!redisUsable()) {
      logger.error(
        'settings cache not invalidated: Redis is unavailable, other instances may serve old values until it expires',
      );
      return;
    }
    try {
      const results = await redis.multi().incr(versionKey).del(overridesKey).exec();
      const failure = results?.find(([error]) => error !== null)?.[0];
      if (results === null || failure !== undefined) {
        throw failure ?? new Error('the cache invalidation transaction was aborted');
      }
    } catch (error) {
      redisFailed();
      logger.error(
        { err: error },
        'settings cache not invalidated, old values may be served until it expires',
      );
    }
  };

  return {
    snapshot,
    async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
      return (await snapshot())[key];
    },
    async set<K extends SettingKey>(key: K, value: unknown): Promise<SettingValue<K>> {
      if (!isSettingKey(key)) {
        throw new ValidationError({
          details: [
            {
              field: 'key',
              code: 'unknown_key',
              messageKey: errorMessageKey(ERROR_CODES.VALIDATION_ERROR),
            },
          ],
        });
      }
      const parsed = SETTING_DEFINITIONS[key].schema.safeParse(value);
      if (!parsed.success) {
        throw new ValidationError({
          details: zodIssuesToDetails(parsed.error, key),
          cause: parsed.error,
        });
      }
      // The parsed value is frozen; the database layer gets a plain copy.
      await store.upsert(key, structuredClone(parsed.data));
      await invalidate();
      return parsed.data as SettingValue<K>;
    },
  };
};
