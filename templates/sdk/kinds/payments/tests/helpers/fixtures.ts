import type { FetchLike } from '../../src/config/options';
import type { MockGateway } from '../../src/mock/gateway';
import type { CreateSessionRequest } from '../../src/types';

export const START = new Date('2026-01-01T00:00:00Z');
export const SECRET = 'webhook-secret-of-at-least-16';
export const API_KEY = 'mock-api-key';
export const instant = { sleep: () => Promise.resolve(), random: () => 0.5 };

export const sessionRequest = (
  overrides: Partial<CreateSessionRequest> = {},
): CreateSessionRequest => ({
  orderId: 'order-1',
  amount: 12_500,
  currency: 'KWD',
  customer: { id: 'cust-1', email: 'a@example.test' },
  description: 'Booking 1',
  returnUrl: 'https://app.example.test/return',
  idempotencyKey: 'key-1',
  ...overrides,
});

/** Routes `fetch` calls straight into `MockGateway.handle` (no sockets). */
export const fetchVia =
  (gateway: MockGateway, calls: string[] = []): FetchLike =>
  (url, init) => {
    const parsed = new URL(url);
    calls.push(`${init.method} ${parsed.pathname}`);
    const answer = gateway.handle({
      method: init.method,
      url: `${parsed.pathname}${parsed.search}`,
      headers: init.headers,
      body: init.body ?? '',
    });
    return Promise.resolve({
      status: answer.status,
      text: () => Promise.resolve(JSON.stringify(answer.body)),
    });
  };

/** Deterministic ids: `sess_1`, `ref_2`, ... */
export const sequentialIds = (): ((prefix: string) => string) => {
  let n = 0;
  return (prefix) => {
    n += 1;
    return `${prefix}_${String(n)}`;
  };
};
