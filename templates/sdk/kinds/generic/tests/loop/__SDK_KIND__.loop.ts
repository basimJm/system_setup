/**
 * Loop test (Rules.md §13): many concurrent calls with failures injected; every call ends in a result
 * or a typed error, nothing is recorded twice, and the heap stays bounded.
 */
import { Fake__SDK_TITLE__Port } from '../../src/adapters/fake';
import { create__SDK_TITLE__ } from '../../src/factory';
import { isSdkError } from '../../src/errors';
import type { __SDK_TITLE__Port, __SDK_TITLE__Request } from '../../src/types';

const ITERATIONS = 500;
const CONCURRENCY = 25;
const FAIL_EVERY = 7;
const HEAP_BUDGET_BYTES = 50 * 1024 * 1024;

describe('__SDK_KIND__ loop', () => {
  it(`runs ${String(ITERATIONS)} calls, ${String(CONCURRENCY)} at a time, every ${String(FAIL_EVERY)}th failing`, async () => {
    const recorder = new Fake__SDK_TITLE__Port();
    const port: __SDK_TITLE__Port = {
      name: 'loop',
      execute: (request: __SDK_TITLE__Request) =>
        Number(request.payload['index']) % FAIL_EVERY === 0
          ? Promise.reject(new Error('injected'))
          : recorder.execute(request),
    };
    const client = create__SDK_TITLE__({
      environment: 'prod',
      provider: 'custom',
      port,
      retry: { maxAttempts: 1 },
    });
    const before = process.memoryUsage().heapUsed;
    let ok = 0;
    let failed = 0;
    for (let start = 0; start < ITERATIONS; start += CONCURRENCY) {
      const batch = Array.from({ length: CONCURRENCY }, (_, offset) => start + offset);
      await Promise.all(
        batch.map(async (index) => {
          try {
            await client.execute({ operation: 'ping', payload: { index } });
            ok += 1;
          } catch (error) {
            expect(isSdkError(error)).toBe(true);
            failed += 1;
          }
        }),
      );
    }
    expect(ok + failed).toBe(ITERATIONS);
    expect(recorder.executed).toHaveLength(ok);
    expect(failed).toBe(Math.ceil(ITERATIONS / FAIL_EVERY));
    expect(process.memoryUsage().heapUsed - before).toBeLessThan(HEAP_BUDGET_BYTES);
  });
});
