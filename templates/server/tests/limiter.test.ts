import express, { type Express } from 'express';
import { Redis, type RedisOptions } from 'ioredis';
import { createServer, type Server, type Socket } from 'node:net';
import request from 'supertest';
import { errorHandler } from '../src/middlewares/errorHandler';
import { language } from '../src/middlewares/language';
import { createRateLimiter } from '../src/middlewares/rateLimit';
import { requestId } from '../src/middlewares/requestId';
import { ExternalServiceError, InternalError } from '../src/utils/errors';
import { normalizeError } from '../src/utils/errors/normalize';
import { createLogger } from '../src/utils/logger';
import { connectRedis, disconnectRedis } from '../src/utils/redis/client';
import {
  deleteKeys,
  flagTtlMs,
  hasFlag,
  hitWindow,
  readCounter,
  setFlag,
  startCooldown,
} from '../src/utils/redis/counter';
import { redisKey } from '../src/utils/redis/keys';
import { createLimiter, toRetryAfterSec } from '../src/utils/redis/limiter';
import { RedisRateLimitStore } from '../src/utils/redis/rateLimitStore';
import { redisUrlForWorker, startTestRedis, type TestRedis } from './helpers/redis';

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

describe('redisKey', () => {
  it('allows separators in the trusted prefix but not in parts', () => {
    expect(redisKey('otp:req', '+962788123456')).toBe('otp:req:+962788123456');
    expect(() => redisKey('otp:req', 'a:b')).toThrow();
    expect(() => redisKey('otp:req', '')).toThrow();
    expect(() => redisKey('otp:req')).toThrow();
  });
});

describe('hitWindow', () => {
  it('counts hits and keeps the expiry of the first hit', async () => {
    const first = await hitWindow(redis, 'c:one', 5_000);
    await sleep(50);
    const second = await hitWindow(redis, 'c:one', 5_000);
    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    expect(second.ttlMs).toBeLessThan(first.ttlMs);
    expect(await readCounter(redis, 'c:one')).toBe(2);
  });

  it('is atomic under concurrency: every hit gets a distinct count', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => hitWindow(redis, 'c:race', 5_000)),
    );
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_unused, i) => i + 1),
    );
    expect(await redis.pttl('c:race')).toBeGreaterThan(0);
  });

  it('starts a fresh window after the old one expires', async () => {
    await hitWindow(redis, 'c:exp', 100);
    await sleep(160);
    expect((await hitWindow(redis, 'c:exp', 100)).count).toBe(1);
  });

  it('gives a counter that lost its expiry a new one', async () => {
    await redis.set('c:immortal', '5');
    const hit = await hitWindow(redis, 'c:immortal', 1_000);
    expect(hit.count).toBe(6);
    expect(await redis.pttl('c:immortal')).toBeGreaterThan(0);
  });
});

describe('flags and cooldowns', () => {
  it('sets, reads and expires a flag', async () => {
    expect(await hasFlag(redis, 'f:one')).toBe(false);
    expect(await flagTtlMs(redis, 'f:one')).toBe(0);
    await setFlag(redis, 'f:one', 120);
    expect(await hasFlag(redis, 'f:one')).toBe(true);
    expect(await flagTtlMs(redis, 'f:one')).toBeGreaterThan(0);
    await sleep(180);
    expect(await hasFlag(redis, 'f:one')).toBe(false);
  });

  it('deletes keys and tolerates an empty list', async () => {
    await redis.set('d:a', '1');
    await deleteKeys(redis, 'd:a', 'd:missing');
    await deleteKeys(redis);
    expect(await redis.exists('d:a')).toBe(0);
  });

  it('lets only the first caller start a cooldown (resend once per period)', async () => {
    const first = await startCooldown(redis, 'cd:one', 150);
    const second = await startCooldown(redis, 'cd:one', 150);
    expect(first).toEqual({ started: true, retryAfterMs: 0 });
    expect(second.started).toBe(false);
    expect(second.retryAfterMs).toBeGreaterThan(0);
    expect(second.retryAfterMs).toBeLessThanOrEqual(150);
    await sleep(210);
    expect((await startCooldown(redis, 'cd:one', 150)).started).toBe(true);
  });

  it('grants exactly one winner when many start the cooldown at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => startCooldown(redis, 'cd:race', 1_000)),
    );
    expect(results.filter((r) => r.started)).toHaveLength(1);
  });
});

describe('limiter without a block (plain window limit)', () => {
  const limiter = (): ReturnType<typeof createLimiter> =>
    createLimiter(redis, { counterPrefix: 'rate:test', limit: 3, windowMs: 150 });

  it('allows up to the limit, then denies until the window resets', async () => {
    const lim = limiter();
    const hits = [
      await lim.hit('u1'),
      await lim.hit('u1'),
      await lim.hit('u1'),
      await lim.hit('u1'),
    ];
    expect(hits.map((h) => h.allowed)).toEqual([true, true, true, false]);
    expect(hits.map((h) => h.remaining)).toEqual([2, 1, 0, 0]);
    expect(hits.every((h) => !h.blocked)).toBe(true);
    expect(hits[3]?.retryAfterMs).toBeGreaterThan(0);
    await sleep(210);
    expect((await lim.hit('u1')).allowed).toBe(true);
  });

  it('keeps subjects independent', async () => {
    const lim = limiter();
    for (let i = 0; i < 4; i += 1) await lim.hit('u1');
    expect((await lim.hit('u2')).allowed).toBe(true);
  });

  it('lets exactly `limit` of many concurrent hits through', async () => {
    const lim = createLimiter(redis, { counterPrefix: 'rate:race', limit: 10, windowMs: 5_000 });
    const decisions = await Promise.all(Array.from({ length: 40 }, () => lim.hit('u1')));
    expect(decisions.filter((d) => d.allowed)).toHaveLength(10);
  });
});

describe('limiter with a block (OTP-style)', () => {
  // 5 requests per window → blocked; here 3 and short times to keep the test fast.
  const create = (): ReturnType<typeof createLimiter> =>
    createLimiter(redis, {
      counterPrefix: 'otp:req',
      blockPrefix: 'otp:block',
      limit: 3,
      windowMs: 1_000,
      blockMs: 200,
    });

  it('allows the hit that reaches the limit, then blocks later hits', async () => {
    const lim = create();
    const first = await lim.hit('+962788123456');
    const second = await lim.hit('+962788123456');
    const third = await lim.hit('+962788123456');
    const fourth = await lim.hit('+962788123456');
    expect([first.allowed, second.allowed, third.allowed, fourth.allowed]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect([first.blocked, second.blocked, third.blocked, fourth.blocked]).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(third.retryAfterMs).toBe(200);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
    expect(fourth.remaining).toBe(0);
  });

  it('reports the block without counting, and uses the documented key names', async () => {
    const lim = create();
    for (let i = 0; i < 3; i += 1) await lim.hit('+962788123456');
    const status = await lim.status('+962788123456');
    expect(status.blocked).toBe(true);
    expect(status.retryAfterMs).toBeGreaterThan(0);
    expect(await redis.exists('otp:block:+962788123456')).toBe(1);
    expect(await redis.exists('otp:req:+962788123456')).toBe(0);
  });

  it('does not count hits while blocked, and starts fresh after the block ends', async () => {
    const lim = create();
    for (let i = 0; i < 5; i += 1) await lim.hit('u1');
    await sleep(260);
    const after = await lim.hit('u1');
    expect(after).toMatchObject({ allowed: true, blocked: false, count: 1 });
  });

  it('is cleared by reset (successful verification, admin unblock)', async () => {
    const lim = create();
    for (let i = 0; i < 3; i += 1) await lim.hit('u1');
    await lim.reset('u1');
    expect(await lim.status('u1')).toEqual({ blocked: false, count: 0, retryAfterMs: 0 });
    expect((await lim.hit('u1')).allowed).toBe(true);
  });

  it('lets two limiters share one block (OTP requests and wrong codes)', async () => {
    const requests = create();
    const wrong = createLimiter(redis, {
      counterPrefix: 'otp:wrong',
      blockPrefix: 'otp:block',
      limit: 2,
      windowMs: 1_000,
      blockMs: 200,
    });
    await wrong.hit('u1');
    const second = await wrong.hit('u1');
    expect(second.blocked).toBe(true);
    expect((await requests.hit('u1')).allowed).toBe(false);
  });

  it('blocks exactly once when many hits race', async () => {
    const lim = create();
    const decisions = await Promise.all(Array.from({ length: 30 }, () => lim.hit('u1')));
    expect(decisions.filter((d) => d.allowed)).toHaveLength(3);
    expect(decisions.filter((d) => d.allowed && d.blocked)).toHaveLength(1);
  });
});

describe('limiter configuration', () => {
  it.each([
    [{ limit: 0, windowMs: 1_000 }],
    [{ limit: 1.5, windowMs: 1_000 }],
    [{ limit: 1, windowMs: 0 }],
    [{ limit: 1, windowMs: 1_000, blockMs: 0 }],
    [{ limit: 1, windowMs: 1_000, blockMs: -5 }],
  ])('rejects %j', (config) => {
    expect(() => createLimiter(redis, { counterPrefix: 'x', ...config })).toThrow();
  });

  it('rejects a block prefix equal to the counter prefix (the counter TTL would read as a block)', () => {
    expect(() =>
      createLimiter(redis, { counterPrefix: 'x', blockPrefix: 'x', limit: 1, windowMs: 1_000 }),
    ).toThrow('blockPrefix must differ from counterPrefix');
  });

  it('keeps the default block flag on its own key, apart from the counter', async () => {
    const lim = createLimiter(redis, {
      counterPrefix: 'rate:dflt',
      limit: 2,
      windowMs: 1_000,
      blockMs: 200,
    });
    await lim.hit('u1');
    expect(await redis.exists('rate:dflt:u1')).toBe(1);
    expect(await redis.exists('rate:dflt:block:u1')).toBe(0);
    await lim.hit('u1');
    expect(await redis.exists('rate:dflt:block:u1')).toBe(1);
    expect(await redis.exists('rate:dflt:u1')).toBe(0);
  });

  it('rejects unsafe subjects', async () => {
    const lim = createLimiter(redis, { counterPrefix: 'x', limit: 1, windowMs: 1_000 });
    await expect(lim.hit('a:b')).rejects.toThrow();
    await expect(lim.hit('')).rejects.toThrow();
  });

  it('rounds the retry time up to whole seconds', () => {
    expect(toRetryAfterSec(1)).toBe(1);
    expect(toRetryAfterSec(1_000)).toBe(1);
    expect(toRetryAfterSec(1_001)).toBe(2);
    expect(toRetryAfterSec(0)).toBe(0);
  });
});

describe('RedisRateLimitStore with express-rate-limit', () => {
  const buildApp = (
    store: RedisRateLimitStore,
    options: { max: number; failOpen?: boolean } = { max: 2 },
  ): Express => {
    const app = express();
    app.use(requestId(logger));
    app.use(language);
    app.get(
      '/limited',
      createRateLimiter({
        windowMs: 60_000,
        max: options.max,
        store,
        failOpen: options.failOpen ?? false,
        logger,
      }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );
    app.use(errorHandler(logger));
    return app;
  };

  it('answers 429 after the budget and stores the counter in Redis', async () => {
    const app = buildApp(new RedisRateLimitStore(redis, 'rate:http:test'));
    expect((await request(app).get('/limited')).status).toBe(200);
    expect((await request(app).get('/limited')).status).toBe(200);
    const third = await request(app).get('/limited');
    expect(third.status).toBe(429);
    expect((third.body as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
    const keys = await redis.keys('rate:http:test:*');
    expect(keys).toHaveLength(1);
    expect(await redis.pttl(keys[0] ?? '')).toBeGreaterThan(0);
  });

  it('shares the budget between API instances', async () => {
    const instanceA = buildApp(new RedisRateLimitStore(redis, 'rate:http:shared'));
    const instanceB = buildApp(new RedisRateLimitStore(redis, 'rate:http:shared'));
    expect((await request(instanceA).get('/limited')).status).toBe(200);
    expect((await request(instanceB).get('/limited')).status).toBe(200);
    expect((await request(instanceA).get('/limited')).status).toBe(429);
    expect((await request(instanceB).get('/limited')).status).toBe(429);
  });

  it('keeps limiters with different prefixes apart', async () => {
    const one = buildApp(new RedisRateLimitStore(redis, 'rate:http:one'), { max: 1 });
    const two = buildApp(new RedisRateLimitStore(redis, 'rate:http:two'), { max: 1 });
    expect((await request(one).get('/limited')).status).toBe(200);
    expect((await request(two).get('/limited')).status).toBe(200);
  });

  it('supports get, decrement and resetKey', async () => {
    const store = new RedisRateLimitStore(redis, 'rate:http:api');
    store.init({ windowMs: 5_000 } as never);
    expect(await store.get('ip1')).toBeUndefined();
    expect((await store.increment('ip1')).totalHits).toBe(1);
    expect((await store.increment('ip1')).totalHits).toBe(2);
    const info = await store.get('ip1');
    expect(info?.totalHits).toBe(2);
    expect(info?.resetTime?.getTime()).toBeGreaterThan(Date.now());
    await store.decrement('ip1');
    expect((await store.get('ip1'))?.totalHits).toBe(1);
    await store.decrement('missing');
    await store.resetKey('ip1');
    expect(await store.get('ip1')).toBeUndefined();
  });

  it('flattens separators in client keys (IPv6) without collisions with other prefixes', async () => {
    const store = new RedisRateLimitStore(redis, 'rate:http:v6');
    store.init({ windowMs: 5_000 } as never);
    await store.increment('2001:db8::1');
    expect(await redis.keys('rate:http:v6:*')).toEqual(['rate:http:v6:2001_db8__1']);
  });

  it('refuses to count before it was initialised', async () => {
    await expect(new RedisRateLimitStore(redis, 'rate:http:x').increment('ip')).rejects.toThrow();
  });

  describe('when Redis is unreachable', () => {
    const brokenStore = (): { store: RedisRateLimitStore; close: () => void } => {
      const dead = new Redis('redis://127.0.0.1:1', {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      });
      dead.on('error', () => undefined);
      return {
        store: new RedisRateLimitStore(dead, 'rate:http:dead'),
        close: () => {
          dead.disconnect();
        },
      };
    };

    it('lets requests through when configured fail-open (global limiter)', async () => {
      const { store, close } = brokenStore();
      const res = await request(buildApp(store, { max: 1, failOpen: true })).get('/limited');
      expect(res.status).toBe(200);
      close();
    });

    it('rejects requests when fail-closed (OTP, login, payments)', async () => {
      const { store, close } = brokenStore();
      const res = await request(buildApp(store, { max: 1, failOpen: false })).get('/limited');
      expect(res.status).toBe(503);
      expect((res.body as { error: { code: string } }).error.code).toBe('INTERNAL');
      close();
    });
  });
});

describe('Redis outage errors are recognised as 503 (real ioredis errors)', () => {
  const offline = (options: RedisOptions = {}): Redis => {
    const client = new Redis('redis://127.0.0.1:1', { lazyConnect: true, ...options });
    client.on('error', () => undefined);
    return client;
  };
  const failure = async (run: () => Promise<unknown>): Promise<unknown> => {
    try {
      await run();
    } catch (error) {
      return error;
    }
    throw new Error('expected the Redis command to fail');
  };
  const expectUnavailable = (error: unknown): void => {
    const result = normalizeError(error);
    expect(result).toBeInstanceOf(ExternalServiceError);
    expect(result.httpStatus).toBe(503);
    expect(result.isOperational).toBe(true);
    expect(result.cause).toBe(error);
  };

  it('maps "max retries per request" (Redis down)', async () => {
    // The client retries until the command gives up; afterwards it is told to stop by itself,
    // because disconnecting a client between attempts leaves ioredis' force-close timer pending.
    let giveUp = false;
    const client = offline({ maxRetriesPerRequest: 1, retryStrategy: () => (giveUp ? null : 20) });
    const error = await failure(() => client.get('a'));
    giveUp = true;
    expect((error as Error).name).toBe('MaxRetriesPerRequestError');
    expectUnavailable(error);
  });

  it('maps a disabled offline queue (no connection yet)', async () => {
    const client = offline({ enableOfflineQueue: false, retryStrategy: () => null });
    const error = await failure(() => client.get('a'));
    client.disconnect();
    expectUnavailable(error);
  });

  it('maps a closed connection', async () => {
    const client = offline();
    client.disconnect();
    expectUnavailable(await failure(() => client.get('a')));
  });

  describe('a server that accepts connections but never answers', () => {
    let silent: Server;
    const sockets = new Set<Socket>();
    let port = 0;

    beforeAll(async () => {
      silent = createServer((socket) => {
        sockets.add(socket);
        socket.on('error', () => undefined);
      });
      await new Promise<void>((resolve) => {
        silent.listen(0, '127.0.0.1', resolve);
      });
      const address = silent.address();
      port = typeof address === 'object' && address !== null ? address.port : 0;
    });

    afterAll(async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => {
        silent.close(resolve);
      });
    });

    it('maps a command timeout', async () => {
      const client = new Redis(`redis://127.0.0.1:${String(port)}`, {
        enableReadyCheck: false,
        commandTimeout: 100,
        maxRetriesPerRequest: 1,
      });
      client.on('error', () => undefined);
      const error = await failure(() => client.get('a'));
      client.disconnect();
      expectUnavailable(error);
    });
  });

  it('does not treat look-alikes as outages', () => {
    for (const lookAlike of [
      new Error('Command timed out later'),
      { message: 'Connection is closed.' },
      Object.assign(new Error('boom'), { name: 'MaxRetries' }),
    ]) {
      const result = normalizeError(lookAlike);
      expect(result).toBeInstanceOf(InternalError);
      expect(result.httpStatus).toBe(500);
    }
  });
});

describe('redisUrlForWorker (parallel Jest workers on a shared Redis)', () => {
  it('gives each worker its own logical DB, 1…15, and keeps DB 0 free', () => {
    const url = 'redis://127.0.0.1:6379';
    expect(redisUrlForWorker(url, '1')).toBe('redis://127.0.0.1:6379/1');
    expect(redisUrlForWorker(url, '3')).toBe('redis://127.0.0.1:6379/3');
    expect(redisUrlForWorker(url, '15')).toBe('redis://127.0.0.1:6379/15');
    expect(redisUrlForWorker(url, '16')).toBe('redis://127.0.0.1:6379/1');
  });

  it('falls back to DB 1 when the worker id is missing or invalid, and keeps scheme, host and port', () => {
    expect(redisUrlForWorker('redis://127.0.0.1:6379', undefined)).toBe('redis://127.0.0.1:6379/1');
    expect(redisUrlForWorker('redis://127.0.0.1:6379', 'x')).toBe('redis://127.0.0.1:6379/1');
    expect(redisUrlForWorker('redis://127.0.0.1:6379', '0')).toBe('redis://127.0.0.1:6379/1');
    expect(redisUrlForWorker('rediss://cache.local:6380/9', '2')).toBe(
      'rediss://cache.local:6380/2',
    );
  });
});
