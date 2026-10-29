/**
 * Loop test (Rules.md §13): thousands of events from concurrent producers through the tracker into
 * a flaky sink; every event is delivered exactly once or counted as dropped, nothing stays queued.
 */
import { createAnalytics } from '../../src/analytics';
import { SdkError } from '../../src/errors';
import type { AnalyticsSink, Envelope } from '../../src/types';

const PRODUCERS = 20;
const EVENTS_PER_PRODUCER = 250;
const HEAP_BUDGET_BYTES = 50 * 1024 * 1024;

const prng = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

describe('analytics loop', () => {
  it(`tracks ${String(PRODUCERS * EVENTS_PER_PRODUCER)} events from ${String(PRODUCERS)} producers through a flaky sink`, async () => {
    const random = prng(20_261_028);
    const seen = new Map<string, number>();
    const sink: AnalyticsSink = {
      name: 'flaky',
      deliver: (batch: readonly Envelope[]) => {
        // ~10 % transient failures (retried), ~1 % permanent (batch dropped and counted).
        const roll = random();
        if (roll < 0.01) return Promise.reject(new Error('permanent'));
        if (roll < 0.11)
          return Promise.reject(new SdkError('X_TRANSIENT', 'transient', { retryable: true }));
        for (const event of batch) seen.set(event.id, (seen.get(event.id) ?? 0) + 1);
        return Promise.resolve();
      },
    };
    const analytics = createAnalytics({
      environment: 'dev',
      provider: 'memory',
      sink,
      batchSize: 40,
      flushIntervalMs: 0,
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    });
    const heapBefore = process.memoryUsage().heapUsed;
    await Promise.all(
      Array.from({ length: PRODUCERS }, async (_, p) => {
        for (let i = 0; i < EVENTS_PER_PRODUCER; i += 1) {
          analytics.track({ name: 'loop_event', userId: `u-${String(p)}`, properties: { i } });
          if (i % 50 === 0) await Promise.resolve();
        }
      }),
    );
    await analytics.close();
    const total = PRODUCERS * EVENTS_PER_PRODUCER;
    expect(analytics.pending).toBe(0);
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
    expect(seen.size + analytics.dropped).toBe(total);
    expect(seen.size).toBeGreaterThan(total * 0.8);
    expect(process.memoryUsage().heapUsed - heapBefore).toBeLessThan(HEAP_BUDGET_BYTES);
  });
});
