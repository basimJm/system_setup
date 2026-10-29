import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { Redis } from 'ioredis';

export interface TestRedis {
  readonly url: string;
  readonly stop: () => Promise<void>;
}

/** Logical DBs 1…N (DB 0 stays free); Redis ships with 16, which is more than any CI worker count. */
const LOGICAL_DB_COUNT = 15;

/**
 * Jest runs suites in parallel workers. On a shared Redis (CI service container) each worker gets
 * its own logical DB, so one suite's `flushdb()` can never erase keys another suite is using.
 */
export const redisUrlForWorker = (url: string, workerId: string | undefined): string => {
  const worker = Number.parseInt(workerId ?? '1', 10);
  const db = ((Number.isInteger(worker) && worker > 0 ? worker - 1 : 0) % LOGICAL_DB_COUNT) + 1;
  const parsed = new URL(url);
  parsed.pathname = `/${String(db)}`;
  return parsed.toString();
};

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });

const waitUntilReady = async (url: string, server?: ChildProcess): Promise<void> => {
  const deadline = Date.now() + 8_000;
  for (;;) {
    const probe = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    probe.on('error', () => undefined);
    try {
      await probe.connect();
      await probe.ping();
      // quit() closes cleanly; disconnect() would leave ioredis' 2-second force-close timer pending,
      // which keeps Jest from exiting after a short suite.
      await probe.quit();
      return;
    } catch {
      // A probe whose connection was refused has already ended; disconnecting it again would only
      // leave ioredis' force-close timer pending.
      if (probe.status !== 'end') probe.disconnect();
      if (server?.exitCode != null) throw new Error('redis-server exited before it was ready');
      if (Date.now() > deadline) throw new Error('redis-server did not become ready in time');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
};

/**
 * A real Redis for tests. Uses `REDIS_TEST_URL` when set (CI service container); otherwise starts a
 * throwaway `redis-server` on a free port. Fails loudly, with instructions, when neither exists.
 */
export const startTestRedis = async (): Promise<TestRedis> => {
  const external = process.env['REDIS_TEST_URL'];
  if (external) {
    const url = redisUrlForWorker(external, process.env['JEST_WORKER_ID']);
    await waitUntilReady(url);
    return { url, stop: () => Promise.resolve() };
  }
  const port = await freePort();
  const server = spawn(
    'redis-server',
    ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'],
    { stdio: 'ignore' },
  );
  const spawnError = new Promise<never>((_resolve, reject) => {
    server.once('error', () => {
      reject(
        new Error(
          'Redis tests need redis-server on PATH or REDIS_TEST_URL (for example redis://127.0.0.1:6379).',
        ),
      );
    });
  });
  const url = `redis://127.0.0.1:${String(port)}`;
  await Promise.race([waitUntilReady(url, server), spawnError]);
  return {
    url,
    stop: () =>
      new Promise((resolve) => {
        server.once('exit', () => {
          resolve();
        });
        server.kill('SIGTERM');
      }),
  };
};
