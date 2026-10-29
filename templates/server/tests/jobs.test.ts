import type { Redis } from 'ioredis';
import { createBullJobScheduler } from '../src/jobs/bullmq';
import { jobId, type JobHandler, type JobScheduler } from '../src/jobs/jobs';
import { connectRedis, disconnectRedis } from '../src/utils/redis/client';
import { createLogger } from '../src/utils/logger';
import { startTestRedis, type TestRedis } from './helpers/redis';

let testRedis: TestRedis;
let redis: Redis;
let scheduler: JobScheduler;
const failures: { id: string; attempt: number; exhausted: boolean }[] = [];
const logger = createLogger({ level: 'silent' });

const until = async (check: () => boolean | Promise<boolean>, timeoutMs = 8_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

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
  failures.length = 0;
  scheduler = createBullJobScheduler({
    redis,
    logger,
    retry: { attempts: 3, backoffMs: 20 },
    onFailure: (event) => failures.push(event),
  });
});
afterEach(async () => {
  await scheduler.close();
});

describe('job ids', () => {
  it('joins parts with a colon and rejects empty parts', () => {
    expect(jobId('item', 'reminder', 'abc', 60)).toBe('item.reminder.abc.60');
    expect(() => jobId()).toThrow(RangeError);
    expect(() => jobId('item', '')).toThrow(RangeError);
    expect(() => jobId('a.b', 'c')).toThrow(RangeError);
  });
});

describe('bullmq job scheduler', () => {
  it('runs a job after its delay with its data and attempt number', async () => {
    const seen: { id: string; data: unknown; attempt: number }[] = [];
    const handler: JobHandler = (job) => {
      seen.push({ id: job.id, data: job.data, attempt: job.attempt });
      return Promise.resolve();
    };
    await scheduler.work({ ping: handler });
    const started = Date.now();
    await scheduler.schedule({
      id: 'a.1',
      name: 'ping',
      data: { n: 7 },
      runAt: new Date(started + 300),
    });
    await until(() => seen.length === 1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
    expect(seen[0]).toEqual({ id: 'a.1', data: { n: 7 }, attempt: 1 });
  });

  it('runs a job whose time is in the past at once', async () => {
    let ran = 0;
    await scheduler.work({
      ping: () => {
        ran += 1;
        return Promise.resolve();
      },
    });
    await scheduler.schedule({ id: 'p.1', name: 'ping', runAt: new Date(Date.now() - 60_000) });
    await until(() => ran === 1);
  });

  it('queues one job per deterministic id', async () => {
    const at = new Date(Date.now() + 60_000);
    expect(await scheduler.schedule({ id: 'x.1', name: 'ping', runAt: at })).toBe(true);
    expect(await scheduler.schedule({ id: 'x.1', name: 'ping', runAt: at })).toBe(false);
    expect(await scheduler.schedule({ id: 'x.2', name: 'ping', runAt: at })).toBe(true);
  });

  it('removes a waiting job so it never runs; removing again or an unknown id is false', async () => {
    let ran = 0;
    await scheduler.work({
      ping: () => {
        ran += 1;
        return Promise.resolve();
      },
    });
    await scheduler.schedule({ id: 'r.1', name: 'ping', runAt: new Date(Date.now() + 200) });
    expect(await scheduler.remove('r.1')).toBe(true);
    expect(await scheduler.remove('r.1')).toBe(false);
    expect(await scheduler.remove('never')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(ran).toBe(0);
  });

  it('allows the same id again after the job finished', async () => {
    let ran = 0;
    await scheduler.work({
      ping: () => {
        ran += 1;
        return Promise.resolve();
      },
    });
    await scheduler.schedule({ id: 'again', name: 'ping', runAt: new Date() });
    await until(() => ran === 1);
    await until(
      async () => await scheduler.schedule({ id: 'again', name: 'ping', runAt: new Date() }),
    );
    await until(() => ran === 2);
  });

  it('retries a failing job with backoff and then succeeds', async () => {
    const attempts: number[] = [];
    await scheduler.work({
      flaky: (job) => {
        attempts.push(job.attempt);
        return job.attempt < 3 ? Promise.reject(new Error('boom')) : Promise.resolve();
      },
    });
    await scheduler.schedule({ id: 'f.1', name: 'flaky', runAt: new Date() });
    await until(() => attempts.length === 3);
    expect(attempts).toEqual([1, 2, 3]);
    expect(failures.map((f) => f.exhausted)).toEqual([false, false]);
    expect(await scheduler.failed(10)).toEqual([]);
  });

  it('keeps a job that used up its retries visible as failed and reports it as exhausted', async () => {
    await scheduler.work({ bad: () => Promise.reject(new Error('always broken')) });
    await scheduler.schedule({ id: 'd.1', name: 'bad', runAt: new Date() });
    await until(async () => (await scheduler.failed(10)).length === 1);
    const [dead] = await scheduler.failed(10);
    expect(dead).toMatchObject({ id: 'd.1', name: 'bad', attempts: 3, reason: 'always broken' });
    expect(dead?.failedAt).toBeInstanceOf(Date);
    expect(failures.at(-1)).toMatchObject({ id: 'd.1', attempt: 3, exhausted: true });
    // A corrected plan can reuse the id.
    expect(
      await scheduler.schedule({ id: 'd.1', name: 'bad', runAt: new Date(Date.now() + 60_000) }),
    ).toBe(true);
  });

  it('fails a job with no handler instead of dropping it silently', async () => {
    await scheduler.work({});
    await scheduler.schedule({ id: 'u.1', name: 'unknown', runAt: new Date() });
    await until(async () => (await scheduler.failed(10)).length === 1);
    expect((await scheduler.failed(10))[0]?.reason).toContain('No handler');
  });

  it('refuses to start two workers', async () => {
    await scheduler.work({});
    expect(() => scheduler.work({})).toThrow('already started');
  });

  it('registers a cron schedule and replaces it by id', async () => {
    await scheduler.repeat({
      id: 'daily',
      name: 'ping',
      cron: '0 9 * * *',
      timeZone: 'Asia/Amman',
    });
    await scheduler.repeat({
      id: 'daily',
      name: 'ping',
      cron: '5 0 * * *',
      timeZone: 'Asia/Amman',
    });
    await expect(
      scheduler.repeat({ id: 'bad', name: 'ping', cron: 'not a cron', timeZone: 'Asia/Amman' }),
    ).rejects.toThrow();
  });
});
