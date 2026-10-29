import { Redis } from 'ioredis';
import { REDIS_READINESS_CHECK_NAME } from '../src/constants/redis';
import { ConflictError, ExternalServiceError } from '../src/utils/errors';
import { runReadinessChecks } from '../src/utils/health';
import { createLogger } from '../src/utils/logger';
import {
  buildRedisOptions,
  connectRedis,
  createRedisReadinessCheck,
  disconnectRedis,
  redisRetryDelay,
} from '../src/utils/redis/client';
import { lockKey } from '../src/utils/redis/keys';
import { acquireLock, withLock } from '../src/utils/redis/lock';
import { startTestRedis, type TestRedis } from './helpers/redis';

const logger = createLogger({ level: 'silent' });
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

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

describe('lockKey', () => {
  it('namespaces and joins parts', () => {
    expect(lockKey('staff', 'abc', '2026-10-12')).toBe('lock:staff:abc:2026-10-12');
    expect(lockKey('draft', 7)).toBe('lock:draft:7');
  });

  it.each([[[]], [['']], [['a:b']], [['ok', '']]])('rejects invalid parts %j', (parts) => {
    expect(() => lockKey(...parts)).toThrow();
  });
});

describe('client', () => {
  it('uses bounded timeouts and a capped exponential retry delay', () => {
    const options = buildRedisOptions();
    expect(options.lazyConnect).toBe(true);
    expect(options.maxRetriesPerRequest).toBeGreaterThan(0);
    expect(redisRetryDelay(1)).toBe(100);
    expect(redisRetryDelay(3)).toBe(400);
    expect(redisRetryDelay(50)).toBe(3_000);
  });

  it('talks to a real server', async () => {
    await redis.set('probe', 'ok');
    expect(await redis.get('probe')).toBe('ok');
  });

  it('rejects with a typed 503 error and never leaks the URL password', async () => {
    const lines: string[] = [];
    const capturing = createLogger({
      level: 'error',
      destination: { write: (line: string) => void lines.push(line) },
    });
    const error: unknown = await connectRedis(
      { redis: { url: 'redis://:s3cretpass@127.0.0.1:1' } },
      capturing,
      { connectTimeout: 300, retryStrategy: () => null },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).httpStatus).toBe(503);
    expect(lines.join('')).not.toContain('s3cretpass');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('readiness check is up with a live server and down when it is unreachable', async () => {
    const check = createRedisReadinessCheck(redis);
    expect(check.name).toBe(REDIS_READINESS_CHECK_NAME);
    expect((await runReadinessChecks([check]))[0]?.status).toBe('up');

    const dead = new Redis('redis://127.0.0.1:1', {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    dead.on('error', () => undefined);
    const down = await runReadinessChecks([createRedisReadinessCheck(dead)], 500);
    expect(down[0]?.status).toBe('down');
    dead.disconnect();
  });
});

describe('distributed lock', () => {
  const key = lockKey('staff', 'one');

  it('is exclusive: a second holder cannot take a held lock', async () => {
    const first = await acquireLock(redis, key, { attempts: 1 });
    const second = await acquireLock(redis, key, { attempts: 1 });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('can be taken again after release, and release is reported once', async () => {
    const lock = await acquireLock(redis, key, { attempts: 1 });
    expect(await lock?.release()).toBe(true);
    expect(await lock?.release()).toBe(false);
    expect(await acquireLock(redis, key, { attempts: 1 })).not.toBeNull();
  });

  it('frees itself when the TTL passes, so a crashed holder cannot block forever', async () => {
    await acquireLock(redis, key, { ttlMs: 100, attempts: 1 });
    await sleep(160);
    expect(await acquireLock(redis, key, { attempts: 1 })).not.toBeNull();
  });

  it('never releases or extends a lock that now belongs to someone else', async () => {
    const stale = await acquireLock(redis, key, { ttlMs: 100, attempts: 1 });
    await sleep(160);
    const current = await acquireLock(redis, key, { attempts: 1 });
    expect(current).not.toBeNull();
    expect(await stale?.release()).toBe(false);
    expect(await stale?.extend(5_000)).toBe(false);
    expect(await redis.exists(key)).toBe(1);
    expect(await current?.release()).toBe(true);
  });

  it('extends the TTL for its owner', async () => {
    const lock = await acquireLock(redis, key, { ttlMs: 150, attempts: 1 });
    expect(await lock?.extend(2_000)).toBe(true);
    await sleep(250);
    expect(await acquireLock(redis, key, { attempts: 1 })).toBeNull();
  });

  it('waits for a busy lock and gets it once it is released', async () => {
    const holder = await acquireLock(redis, key, { attempts: 1 });
    setTimeout(() => void holder?.release(), 120);
    const waiter = await acquireLock(redis, key, { attempts: 20, retryDelayMs: 30 });
    expect(waiter).not.toBeNull();
  });

  it('gives up after the configured attempts', async () => {
    await acquireLock(redis, key, { attempts: 1 });
    const started = Date.now();
    expect(await acquireLock(redis, key, { attempts: 3, retryDelayMs: 20 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('keeps different keys independent', async () => {
    expect(await acquireLock(redis, lockKey('staff', 'a'), { attempts: 1 })).not.toBeNull();
    expect(await acquireLock(redis, lockKey('staff', 'b'), { attempts: 1 })).not.toBeNull();
  });
});

describe('withLock', () => {
  const key = lockKey('draft', 'x');

  it('runs the task, returns its result and releases afterwards', async () => {
    expect(await withLock(redis, key, () => Promise.resolve(42))).toBe(42);
    expect(await redis.exists(key)).toBe(0);
  });

  it('releases the lock even when the task throws', async () => {
    await expect(withLock(redis, key, () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );
    expect(await redis.exists(key)).toBe(0);
  });

  it('throws a 409 ConflictError by default when the lock stays busy', async () => {
    await acquireLock(redis, key, { attempts: 1 });
    const error: unknown = await withLock(redis, key, () => Promise.resolve(1), {
      attempts: 2,
      retryDelayMs: 10,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
  });

  it('lets the caller choose the error for a busy lock', async () => {
    await acquireLock(redis, key, { attempts: 1 });
    await expect(
      withLock(redis, key, () => Promise.resolve(1), {
        attempts: 1,
        busyError: () => new RangeError('slot taken'),
      }),
    ).rejects.toThrow(RangeError);
  });

  it('serializes concurrent read-modify-write sections (no lost updates)', async () => {
    let counter = 0;
    const increment = (): Promise<void> =>
      withLock(
        redis,
        key,
        async () => {
          const current = counter;
          await sleep(5);
          counter = current + 1;
        },
        { attempts: 200, retryDelayMs: 5 },
      );
    await Promise.all(Array.from({ length: 15 }, increment));
    expect(counter).toBe(15);
  });
});
