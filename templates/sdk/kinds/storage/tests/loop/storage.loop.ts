/**
 * Loop test (Rules.md §13): many upload lifecycles, concurrently, on the memory adapter and on the
 * S3 adapter against the wire emulator; nothing may be left behind and memory must stay flat.
 */
import { MemoryStorage } from '../../src/adapters/memory';
import { resolveConfig } from '../../src/config/options';
import { createStorage, type StorageProvider } from '../../src';
import { MiniS3 } from '../helpers/miniS3';

const ITERATIONS = 100;
const CONCURRENCY = 20;
const MAX_BYTES = 1_000;
const WRONG_RATIO = 0.2;
const HEAP_BUDGET_BYTES = 50 * 1024 * 1024;

/** Seeded PRNG so a failing run can be reproduced. */
const prng = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

type Put = (url: string, key: string, body: Buffer, contentType: string) => void;

const lifecycle = async (
  store: StorageProvider,
  put: Put,
  index: number,
  wrong: boolean,
): Promise<string> => {
  const key = `loop/${String(index)}/photo.jpg`;
  const visibility = index % 5 === 0 ? 'PRIVATE' : 'PUBLIC';
  const claimed = 'image/jpeg';
  const target = await store.createUploadUrl({
    key,
    visibility,
    contentType: claimed,
    maxBytes: MAX_BYTES,
    expiresInSec: 60,
  });
  put(target.url, key, Buffer.from(`body-${String(index)}`), wrong ? 'text/plain' : claimed);
  const result = await store.confirmUpload({
    key,
    visibility,
    contentType: claimed,
    maxBytes: MAX_BYTES,
  });
  if (result.status === 'REJECTED') return result.reason;
  if (visibility === 'PUBLIC') store.getPublicUrl(key);
  else await store.getSignedUrl({ key, expiresInSec: 60 });
  if ((await store.read(key)) === null) throw new Error('confirmed object unreadable');
  await store.delete([key]);
  return 'CONFIRMED';
};

const runBatch = async (
  store: StorageProvider,
  put: Put,
  seed: number,
): Promise<Map<string, number>> => {
  const random = prng(seed);
  const outcomes = new Map<string, number>();
  const jobs = Array.from({ length: ITERATIONS }, (_, index) => async () => {
    const outcome = await lifecycle(store, put, index, random() < WRONG_RATIO);
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
  });
  for (let start = 0; start < jobs.length; start += CONCURRENCY)
    await Promise.all(jobs.slice(start, start + CONCURRENCY).map((job) => job()));
  return outcomes;
};

const expectClean = (outcomes: Map<string, number>): void => {
  expect((outcomes.get('CONFIRMED') ?? 0) + (outcomes.get('TYPE_MISMATCH') ?? 0)).toBe(ITERATIONS);
  expect(outcomes.get('TYPE_MISMATCH')).toBeGreaterThan(0);
};

describe('storage loop', () => {
  it(`runs ${String(ITERATIONS)} lifecycles on the memory adapter, ${String(CONCURRENCY)} at a time`, async () => {
    const memory = new MemoryStorage(
      resolveConfig({
        environment: 'dev',
        provider: 'memory',
        cdn: { baseUrl: 'http://localhost:9000/cdn' },
      }),
    );
    const heapBefore = process.memoryUsage().heapUsed;
    const outcomes = await runBatch(
      memory,
      (_url, key, body, contentType) => {
        expect(memory.simulateUpload(key, body, contentType)).toBe(true);
      },
      20_261_028,
    );
    expectClean(outcomes);
    expect(memory.size).toBe(0);
    expect(process.memoryUsage().heapUsed - heapBefore).toBeLessThan(HEAP_BUDGET_BYTES);
  });

  it(`runs ${String(ITERATIONS)} lifecycles through the S3 adapter against the wire emulator`, async () => {
    const wire = new MiniS3();
    const store = createStorage({
      environment: 'dev',
      provider: 's3',
      cdn: { baseUrl: 'http://localhost:9000/cdn' },
      s3: {
        region: 'us-east-1',
        publicBucket: 'loop-public',
        privateBucket: 'loop-private',
        endpoint: 'http://localhost:9000',
        credentials: { accessKeyId: 'loop-user', secretAccessKey: 'loop-secret' },
      },
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2, jitterRatio: 0 },
      fetch: wire.fetch,
    });
    const outcomes = await runBatch(
      store,
      (url, _key, body, contentType) => {
        wire.put(url, body, contentType);
      },
      7,
    );
    expectClean(outcomes);
    expect(wire.size).toBe(0);
  });
});
