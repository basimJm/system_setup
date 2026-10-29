import { FakeSink } from '../src/adapters/memory';
import { HttpSink } from '../src/adapters/http';
import { createAnalytics } from '../src/analytics';
import { resolveConfig } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/analytics';
import { SdkError } from '../src/errors';
import { Tracker, realTimers } from '../src/tracker';
import type { Logger } from '../src';
import { ManualTimers } from './helpers/timers';

const START = new Date('2026-01-01T00:00:00Z');
const instant = { sleep: () => Promise.resolve(), random: () => 0.5 };

interface Harness {
  tracker: Tracker;
  sink: FakeSink;
  timers: ManualTimers;
  logs: unknown[][];
}

const harness = (overrides: Record<string, unknown> = {}): Harness => {
  const logs: unknown[][] = [];
  const logger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: (...a) => logs.push(['warn', ...a]),
    error: (...a) => logs.push(['error', ...a]),
  };
  const sink = new FakeSink();
  const timers = new ManualTimers();
  let n = 0;
  const tracker = new Tracker(
    resolveConfig({
      environment: 'dev',
      provider: 'fake',
      batchSize: 3,
      maxQueue: 5,
      flushIntervalMs: 100,
      retry: { maxAttempts: 2 },
      logger,
      now: () => START,
      timers,
      ...overrides,
    }),
    {
      sink,
      retryDeps: instant,
      idGenerator: () => {
        n += 1;
        return `id-${String(n)}`;
      },
    },
  );
  return { tracker, sink, timers, logs };
};

describe('Tracker', () => {
  it('normalises events and links, batches by size and flushes the rest on demand', async () => {
    const h = harness();
    h.tracker.track({ name: 'app_open', anonymousId: 'anon-1' });
    h.tracker.linkIdentity({ anonymousId: 'anon-1', userId: 'u1', occurredAt: new Date(1) });
    expect(h.tracker.pending).toBe(2);
    expect(h.timers.armed).toBe(true);
    h.tracker.track({
      name: 'booking_created',
      userId: 'u1',
      properties: { amount: 5 },
      occurredAt: new Date(2),
    });
    await h.tracker.flush();
    expect(h.sink.batches).toEqual([3]);
    expect(h.sink.events).toEqual([
      {
        id: 'id-1',
        type: 'track',
        name: 'app_open',
        anonymousId: 'anon-1',
        properties: {},
        occurredAt: START,
      },
      {
        id: 'id-2',
        type: 'identity',
        name: 'identity_linked',
        userId: 'u1',
        anonymousId: 'anon-1',
        properties: {},
        occurredAt: new Date(1),
      },
      {
        id: 'id-3',
        type: 'track',
        name: 'booking_created',
        userId: 'u1',
        properties: { amount: 5 },
        occurredAt: new Date(2),
      },
    ]);
    expect(h.timers.cleared).toBeGreaterThan(0);
    h.tracker.track({ name: 'x_y', userId: 'u1' });
    await h.tracker.flush();
    expect(h.sink.batches).toEqual([3, 1]);
    expect(h.tracker.pending).toBe(0);
    await h.tracker.flush();
    expect(h.sink.batches).toEqual([3, 1]);
  });

  it('flushes on the timer and not at all when the interval is 0', async () => {
    const h = harness();
    h.tracker.track({ name: 'a_b', userId: 'u' });
    expect(h.timers.delays).toEqual([100]);
    h.timers.fire();
    await h.tracker.flush();
    expect(h.sink.events).toHaveLength(1);
    const silent = harness({ flushIntervalMs: 0 });
    silent.tracker.track({ name: 'a_b', userId: 'u' });
    expect(silent.timers.armed).toBe(false);
  });

  it('drops the oldest when the queue is full and counts sink losses after retries', async () => {
    const h = harness({ batchSize: 100 });
    for (let i = 0; i < 7; i += 1) h.tracker.track({ name: `e_${String(i)}`, userId: 'u' });
    expect(h.tracker.pending).toBe(5);
    expect(h.tracker.dropped).toBe(2);
    expect(h.logs[0]).toEqual([
      'warn',
      'analytics queue full, oldest event dropped',
      { maxQueue: 5 },
    ]);
    h.sink.failWith = new SdkError('X_DOWN', 'down', { retryable: true });
    await h.tracker.flush();
    expect(h.sink.refused).toBe(2);
    expect(h.tracker.dropped).toBe(7);
    expect(h.logs.at(-1)).toEqual([
      'error',
      'analytics batch lost',
      { sink: 'fake', size: 5, reason: 'X_DOWN' },
    ]);
    h.sink.failWith = new Error('plain');
    h.tracker.track({ name: 'again', userId: 'u' });
    await h.tracker.flush();
    expect(h.sink.refused).toBe(3);
    expect(h.logs.at(-1)).toEqual([
      'error',
      'analytics batch lost',
      { sink: 'fake', size: 1, reason: ERROR_CODES.SINK_FAILED },
    ]);
  });

  it('validates input, refuses tracking after close and closes the sink', async () => {
    const closed: string[] = [];
    const h = harness();
    const sink = {
      name: 's',
      deliver: () => Promise.resolve(),
      close: () => {
        closed.push('sink');
        return Promise.resolve();
      },
    };
    const tracker = new Tracker(resolveConfig({ environment: 'dev', provider: 'memory', sink }), {
      sink,
    });
    expect(() => {
      h.tracker.track({ name: 'Bad Name', userId: 'u' });
    }).toThrow(expect.objectContaining({ code: ERROR_CODES.VALIDATION_FAILED }) as Error);
    tracker.track({ name: 'a_b', userId: 'u' });
    await tracker.close();
    expect(closed).toEqual(['sink']);
    expect(() => {
      tracker.track({ name: 'a_b', userId: 'u' });
    }).toThrow(expect.objectContaining({ code: ERROR_CODES.UNAVAILABLE }) as Error);
    await h.tracker.close();
  });

  it('exposes real timers that do not keep the process alive', () => {
    const handle = realTimers.set(() => undefined, 10_000);
    expect(handle).toBeDefined();
    realTimers.clear(handle);
  });
});

describe('createAnalytics', () => {
  it('builds the sink from the provider or the injected one', async () => {
    const fake = createAnalytics({ environment: 'dev', provider: 'fake' });
    expect(fake.sink).toBeInstanceOf(FakeSink);
    fake.track({ name: 'a_b', userId: 'u' });
    await fake.close();
    expect((fake.sink as FakeSink).events).toHaveLength(1);
    expect(createAnalytics({ environment: 'dev', provider: 'memory' }).sink.name).toBe('memory');
    expect(
      createAnalytics({
        environment: 'dev',
        provider: 'http',
        http: { endpoint: 'http://localhost:1' },
      }).sink,
    ).toBeInstanceOf(HttpSink);
    expect(
      createAnalytics({
        environment: 'dev',
        provider: 'http',
        http: { endpoint: 'http://localhost:1' },
        fetch: () => Promise.resolve({ status: 200 }),
      }).sink,
    ).toBeInstanceOf(HttpSink);
    const custom = { name: 'custom', deliver: () => Promise.resolve() };
    expect(createAnalytics({ environment: 'prod', provider: 'memory', sink: custom }).sink).toBe(
      custom,
    );
    expect(() => createAnalytics({ environment: 'prod', provider: 'fake' })).toThrow(
      expect.objectContaining({ code: ERROR_CODES.CONFIG_INVALID }) as Error,
    );
  });
});
