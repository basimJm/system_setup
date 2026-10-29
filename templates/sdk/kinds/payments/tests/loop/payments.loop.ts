/**
 * Loop test (Rules.md §13): many checkout lifecycles through the fake gateway and through the http
 * adapter against the mock protocol, concurrently, with outages, duplicate keys and refunds.
 */
import { createPayments } from '../../src/payments';
import { FakeGateway } from '../../src/adapters/fake';
import { resolveConfig } from '../../src/config/options';
import { MockGateway } from '../../src/mock/gateway';
import type { PaymentGateway } from '../../src/types';
import { API_KEY, SECRET, fetchVia, sessionRequest } from '../helpers/fixtures';

const ITERATIONS = 150;
const CONCURRENCY = 25;
const HEAP_BUDGET_BYTES = 50 * 1024 * 1024;

const prng = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

type Settle = (
  sessionId: string,
  status: 'PAID' | 'FAILED',
) => { headers: Record<string, string>; body: string };

const lifecycle = async (
  gateway: PaymentGateway,
  settle: Settle,
  index: number,
  random: () => number,
): Promise<string> => {
  const request = sessionRequest({
    orderId: `order-${String(index)}`,
    idempotencyKey: `key-${String(index)}`,
  });
  const [a, b] = await Promise.all([
    gateway.createSession(request),
    gateway.createSession(request),
  ]);
  if (a.sessionId !== b.sessionId) throw new Error('idempotency broke');
  const outcome = random() < 0.2 ? 'FAILED' : 'PAID';
  const webhook = settle(a.sessionId, outcome);
  const event = await gateway.parseWebhook({ headers: webhook.headers, rawBody: webhook.body });
  if (event.sessionId !== a.sessionId) throw new Error('webhook session mismatch');
  const state = await gateway.verify(a.sessionId);
  if (state.status !== outcome) throw new Error(`status ${state.status} != ${outcome}`);
  if (outcome === 'PAID') {
    const refund = {
      sessionId: a.sessionId,
      reason: 'loop',
      idempotencyKey: `refund-${String(index)}`,
    };
    const [r1, r2] = await Promise.all([gateway.refund(refund), gateway.refund(refund)]);
    if (r1.refundId !== r2.refundId || r1.amount !== request.amount)
      throw new Error('refund broke');
    if ((await gateway.verify(a.sessionId)).status !== 'REFUNDED') throw new Error('not refunded');
  }
  return outcome;
};

const runBatch = async (
  gateway: PaymentGateway,
  settle: Settle,
  seed: number,
): Promise<Map<string, number>> => {
  const random = prng(seed);
  const outcomes = new Map<string, number>();
  const jobs = Array.from({ length: ITERATIONS }, (_, index) => async () => {
    const outcome = await lifecycle(gateway, settle, index, random);
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
  });
  for (let start = 0; start < jobs.length; start += CONCURRENCY)
    await Promise.all(jobs.slice(start, start + CONCURRENCY).map((job) => job()));
  expect((outcomes.get('PAID') ?? 0) + (outcomes.get('FAILED') ?? 0)).toBe(ITERATIONS);
  expect(outcomes.get('FAILED')).toBeGreaterThan(0);
  return outcomes;
};

describe('payments loop', () => {
  it(`runs ${String(ITERATIONS)} lifecycles on the fake gateway, ${String(CONCURRENCY)} at a time`, async () => {
    const fake = new FakeGateway(
      resolveConfig({ environment: 'dev', provider: 'fake', webhookSecret: SECRET }),
    );
    const heapBefore = process.memoryUsage().heapUsed;
    await runBatch(fake, (id, status) => fake.settle(id, status), 20_261_028);
    expect(fake.ledger.size).toBe(ITERATIONS);
    fake.ledger.clear();
    expect(process.memoryUsage().heapUsed - heapBefore).toBeLessThan(HEAP_BUDGET_BYTES);
  });

  it(`runs ${String(ITERATIONS)} lifecycles through the http adapter against the mock protocol with outages`, async () => {
    const mock = new MockGateway({
      apiKey: API_KEY,
      webhookSecret: SECRET,
      sessionTtlSec: 60,
      checkoutUrl: 'http://localhost:4242/pay',
      now: () => new Date(),
    });
    const random = prng(7);
    const gateway = createPayments({
      environment: 'dev',
      provider: 'http',
      webhookSecret: SECRET,
      http: { baseUrl: 'http://localhost:4242', apiKey: API_KEY },
      retry: { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 2, jitterRatio: 0 },
      fetch: (url, init) => {
        if (random() < 0.1) mock.nextStatus.push(503);
        return fetchVia(mock)(url, init);
      },
    });
    await runBatch(
      gateway,
      (id, status) => {
        const webhook = mock.ledger.settle(id, status);
        if (typeof webhook === 'string') throw new Error(webhook);
        return webhook;
      },
      7,
    );
    expect(mock.ledger.size).toBe(ITERATIONS);
  });
});
