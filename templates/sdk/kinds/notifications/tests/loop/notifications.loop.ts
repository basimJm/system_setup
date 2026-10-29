/**
 * Loop test (Rules.md §13): many push + email sends, concurrently, with invalid tokens, retryable
 * tokens, whole-call failures and duplicate keys; every token is delivered exactly once.
 */
import { FakeEmailSender, FakePushSender } from '../../src/adapters/fake';
import { MemoryIdempotencyStore } from '../../src/adapters/memory-idempotency';
import { resolveConfig } from '../../src/config/options';
import { NotifierService } from '../../src/notifier';
import type { PushMessage, PushSender, TokenResult } from '../../src/types';

const ITERATIONS = 300;
const CONCURRENCY = 25;
const TOKENS_PER_PUSH = 7;
const HEAP_BUDGET_BYTES = 50 * 1024 * 1024;

const prng = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

describe('notifications loop', () => {
  it(`delivers ${String(ITERATIONS)} push + email flows exactly once with failures injected`, async () => {
    const random = prng(20_261_028);
    const delivered = new Map<string, number>();
    const inner = new FakePushSender();
    const push: PushSender = {
      name: 'loop',
      send: async (message: PushMessage): Promise<readonly TokenResult[]> => {
        if (random() < 0.1) throw new Error('transient');
        const results = await inner.send(message);
        return results.map((result) => {
          if (result.status === 'SENT' && random() < 0.1)
            return { ...result, status: 'RETRYABLE' as const };
          if (result.status === 'SENT')
            delivered.set(result.token, (delivered.get(result.token) ?? 0) + 1);
          return result;
        });
      },
    };
    const mail = new FakeEmailSender();
    let now = 0;
    const store = new MemoryIdempotencyStore(() => new Date(now));
    const notifier = new NotifierService(
      resolveConfig({
        environment: 'dev',
        push: { provider: 'custom' },
        email: { provider: 'custom' },
        pushSender: push,
        emailSender: mail,
        maxTokensPerSend: 3,
        retry: { maxAttempts: 6, baseDelayMs: 1, maxDelayMs: 2 },
      }),
      {
        pushSender: push,
        emailSender: mail,
        idempotencyStore: store,
        retryDeps: { sleep: () => Promise.resolve(), random },
      },
    );
    const heapBefore = process.memoryUsage().heapUsed;
    let invalid = 0;
    let duplicates = 0;

    const flow = async (index: number): Promise<void> => {
      const tokens = Array.from(
        { length: TOKENS_PER_PUSH },
        (_, t) => `t-${String(index)}-${String(t)}`,
      );
      const bad = tokens[0] ?? '';
      inner.invalid.add(bad);
      const key = `push-${String(index)}`;
      const [first, second] = await Promise.all([
        notifier.sendPush(
          { tokens, body: 'hello', data: { i: String(index) } },
          { idempotencyKey: key },
        ),
        notifier.sendPush({ tokens, body: 'hello' }, { idempotencyKey: key }),
      ]);
      const report = first.duplicate ? second : first;
      if (!(first.duplicate !== second.duplicate)) throw new Error('idempotency broke');
      duplicates += 1;
      if (report.invalidTokens.length !== 1 || report.invalidTokens[0] !== bad)
        throw new Error('invalid token missed');
      invalid += 1;
      if (report.sent + report.failed !== TOKENS_PER_PUSH - 1)
        throw new Error('report does not add up');
      const email = await notifier.sendEmail(
        { to: [`u${String(index)}@example.test`], subject: `s${String(index)}`, text: 'body' },
        { idempotencyKey: `mail-${String(index)}` },
      );
      if (email.duplicate) throw new Error('email duplicate');
    };

    const jobs = Array.from({ length: ITERATIONS }, (_, index) => () => flow(index));
    for (let start = 0; start < jobs.length; start += CONCURRENCY)
      await Promise.all(jobs.slice(start, start + CONCURRENCY).map((job) => job()));

    expect(invalid).toBe(ITERATIONS);
    expect(duplicates).toBe(ITERATIONS);
    expect(mail.sent).toHaveLength(ITERATIONS);
    expect([...delivered.values()].every((n) => n === 1)).toBe(true);
    expect(delivered.size).toBeGreaterThan(ITERATIONS * (TOKENS_PER_PUSH - 1) * 0.9);
    now = 86_400_001;
    expect(store.prune()).toBe(0);
    expect(process.memoryUsage().heapUsed - heapBefore).toBeLessThan(HEAP_BUDGET_BYTES);
  });
});
