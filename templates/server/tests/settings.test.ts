import type { Redis } from 'ioredis';
import { SETTING_DEFAULTS } from '../src/constants/settings';
import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  createSettingsService,
  isSettingKey,
  type SettingsStore,
  type StoredSetting,
} from '../src/domain/settings';
import { ValidationError } from '../src/utils/errors';
import { createLogger } from '../src/utils/logger';
import { connectRedis, disconnectRedis } from '../src/utils/redis/client';
import { startTestRedis, type TestRedis } from './helpers/redis';

const logger = createLogger({ level: 'silent' });
let testRedis: TestRedis;
let redis: Redis;
beforeAll(async () => {
  testRedis = await startTestRedis();
  redis = await connectRedis({ redis: { url: testRedis.url } }, logger);
});
afterAll(async () => {
  await disconnectRedis(redis);
  await testRedis.stop();
});
beforeEach(async () => {
  await redis.flushdb();
});

const memoryStore = (): SettingsStore & { rows: StoredSetting[]; reads: number } => {
  const rows: StoredSetting[] = [];
  return {
    rows,
    reads: 0,
    findAllEntries() {
      this.reads += 1;
      return Promise.resolve([...rows]);
    },
    upsert(key, value) {
      const index = rows.findIndex((row) => row.key === key);
      if (index >= 0) rows[index] = { key, value };
      else rows.push({ key, value });
      return Promise.resolve(undefined);
    },
  };
};

describe('settings registry', () => {
  it('defines every default key with a schema its default satisfies', () => {
    expect([...SETTING_KEYS].sort()).toEqual(Object.keys(SETTING_DEFAULTS).sort());
    for (const key of SETTING_KEYS) {
      expect(
        SETTING_DEFINITIONS[key].schema.safeParse(SETTING_DEFINITIONS[key].default).success,
      ).toBe(true);
    }
  });

  it('knows its keys and nothing inherited from Object', () => {
    expect(isSettingKey('otp.length')).toBe(true);
    for (const notAKey of ['toString', '__proto__', 'constructor', '', 'otp', 5, null])
      expect(isSettingKey(notAKey)).toBe(false);
  });

  it.each([
    ['otp.length', 6, true],
    ['otp.length', 3, false],
    ['otp.length', 11, false],
    ['otp.length', '6', false],
    ['pagination.appPageSize', 100, true],
    ['pagination.appPageSize', 101, false],
    ['timezone', 'Asia/Amman', true],
    ['timezone', 'Mars/Olympus', false],
    ['items.maxPerOwner', 0, false],
  ] as const)('%s accepts %p: %s', (key, value, ok) => {
    expect(SETTING_DEFINITIONS[key].schema.safeParse(value).success).toBe(ok);
  });
});

describe('settings service', () => {
  it('returns defaults, saves validated overrides and caches them in Redis for every instance', async () => {
    const store = memoryStore();
    const a = createSettingsService({ store, redis, logger });
    const b = createSettingsService({ store, redis, logger });
    expect(await a.get('otp.length')).toBe(6);
    expect(await a.set('otp.length', 4)).toBe(4);
    expect(await b.get('otp.length')).toBe(4);
    expect(store.rows).toEqual([{ key: 'otp.length', value: 4 }]);
    const reads = store.reads;
    await b.get('otp.resendAfterSec');
    await a.get('otp.resendAfterSec');
    expect(store.reads).toBe(reads);
  });

  it('refuses unknown keys and invalid values with field details', async () => {
    const service = createSettingsService({ store: memoryStore(), redis, logger });
    await expect(service.set('nope' as never, 1)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.set('otp.length', 99)).rejects.toBeInstanceOf(ValidationError);
    expect(await service.get('otp.length')).toBe(6);
  });

  it('ignores unknown or invalid stored values and falls back to the default', async () => {
    const store = memoryStore();
    store.rows.push({ key: 'otp.length', value: 'six' }, { key: 'legacy.key', value: 1 });
    const service = createSettingsService({ store, redis, logger });
    expect(await service.get('otp.length')).toBe(6);
    const snapshot = await service.snapshot();
    expect(Object.keys(snapshot).sort()).toEqual([...SETTING_KEYS].sort());
  });

  it('reads the database when Redis is unavailable', async () => {
    const store = memoryStore();
    store.rows.push({ key: 'otp.length', value: 5 });
    const broken = {
      get: () => Promise.reject(new Error('down')),
      eval: () => Promise.reject(new Error('down')),
      multi: () => ({
        incr: () => ({ del: () => ({ exec: () => Promise.reject(new Error('down')) }) }),
      }),
    } as unknown as Redis;
    const service = createSettingsService({ store, redis: broken, logger });
    expect(await service.get('otp.length')).toBe(5);
    expect(await service.set('otp.length', 7)).toBe(7);
  });
});
