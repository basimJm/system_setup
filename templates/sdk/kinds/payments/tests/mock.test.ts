import { MockGateway, type MockRequest } from '../src/mock/gateway';
import { API_KEY, SECRET, START, sequentialIds } from './helpers/fixtures';

const auth = { authorization: `Bearer ${API_KEY}`, 'idempotency-key': 'k1' };
const request = (overrides: Partial<MockRequest>): MockRequest => ({
  method: 'POST',
  url: '/v1/sessions',
  headers: auth,
  body: JSON.stringify({ orderId: 'o1', amount: 100, currency: 'JOD' }),
  ...overrides,
});

const build = (autoSettle?: 'PAID'): MockGateway =>
  new MockGateway({
    apiKey: API_KEY,
    webhookSecret: SECRET,
    sessionTtlSec: 60,
    checkoutUrl: 'http://localhost:4242/pay',
    now: () => START,
    idGenerator: sequentialIds(),
    ...(autoSettle ? { autoSettle } : {}),
  });

describe('MockGateway.handle', () => {
  it('answers the session, settle and refund protocol', () => {
    const mock = build();
    const created = mock.handle(request({}));
    expect(created).toEqual({
      status: 201,
      body: {
        sessionId: 'sess_1',
        redirectUrl: 'http://localhost:4242/pay/sess_1',
        expiresAt: '2026-01-01T00:01:00.000Z',
        status: 'PENDING',
      },
    });
    expect(mock.handle(request({})).status).toBe(200);
    expect(
      mock.handle(request({ body: JSON.stringify({ orderId: 'o1', amount: 1, currency: 'JOD' }) })),
    ).toEqual({
      status: 409,
      body: { error: { code: 'IDEMPOTENCY_CONFLICT' } },
    });
    expect(
      mock.handle(request({ method: 'GET', url: '/v1/sessions/sess_1?x=1', body: '' })).body,
    ).toMatchObject({ status: 'PENDING' });
    const settled = mock.handle(
      request({ url: '/v1/sessions/sess_1/settle', body: JSON.stringify({ status: 'PAID' }) }),
    );
    expect(settled.status).toBe(200);
    expect((settled.body.webhook as { body: string }).body).toContain('PAYMENT_PAID');
    expect(
      mock.handle(
        request({ url: '/v1/sessions/sess_1/settle', body: JSON.stringify({ status: 'PAID' }) }),
      ).status,
    ).toBe(422);
    expect(
      mock.handle(
        request({ url: '/v1/sessions/sess_1/settle', body: JSON.stringify({ status: 'LOST' }) }),
      ).status,
    ).toBe(422);
    const refund = mock.handle(
      request({
        url: '/v1/refunds',
        headers: { ...auth, 'idempotency-key': 'r1' },
        body: JSON.stringify({ sessionId: 'sess_1', amount: 40 }),
      }),
    );
    expect(refund).toEqual({
      status: 201,
      body: { refundId: 'rf_4', status: 'REFUNDED', amount: 40 },
    });
    expect(
      mock.handle(
        request({
          url: '/v1/refunds',
          headers: { ...auth, 'idempotency-key': 'r1' },
          body: JSON.stringify({ sessionId: 'sess_1', amount: 40 }),
        }),
      ).status,
    ).toBe(200);
    expect(
      mock.handle(
        request({
          url: '/v1/refunds',
          headers: { ...auth, 'idempotency-key': 'r2' },
          body: JSON.stringify({ sessionId: 'sess_1', amount: 61 }),
        }),
      ).status,
    ).toBe(409);
    expect(
      mock.handle(request({ method: 'GET', url: '/v1/sessions/sess_1', body: '' })).body,
    ).toMatchObject({ paidAt: START.toISOString(), reference: 'ref_2' });
  });

  it('refuses bad credentials, bad bodies, unknown routes and forced statuses', () => {
    const mock = build();
    expect(mock.handle(request({ headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    expect(mock.handle(request({ headers: { Authorization: [`Bearer ${API_KEY}`] } })).status).toBe(
      400,
    );
    expect(mock.handle(request({ body: 'not json' })).status).toBe(400);
    expect(mock.handle(request({ body: '[1]' })).status).toBe(400);
    expect(mock.handle(request({ body: JSON.stringify({ orderId: 1 }) })).status).toBe(422);
    expect(
      mock.handle(request({ url: '/v1/refunds', body: JSON.stringify({ sessionId: 1 }) })).status,
    ).toBe(422);
    expect(mock.handle(request({ url: '/v1/refunds', body: 'x' })).status).toBe(400);
    expect(
      mock.handle(request({ url: '/v1/refunds', body: JSON.stringify({ sessionId: 'sess_9' }) }))
        .status,
    ).toBe(404);
    expect(
      mock.handle(request({ method: 'GET', url: '/v1/sessions/sess_9', body: '' })).status,
    ).toBe(404);
    expect(
      mock.handle(
        request({ url: '/v1/sessions/sess_9/settle', body: JSON.stringify({ status: 'PAID' }) }),
      ).status,
    ).toBe(404);
    expect(mock.handle(request({ method: 'DELETE', url: '/v1/other', body: '' })).status).toBe(404);
    mock.nextStatus.push(503);
    expect(mock.handle(request({})).status).toBe(503);
  });

  it('auto-settles new sessions when configured', () => {
    const mock = build('PAID');
    expect(mock.handle(request({})).body).toMatchObject({ status: 'PAID' });
    expect(
      mock.handle(request({ method: 'GET', url: '/v1/sessions/sess_1', body: '' })).body,
    ).toMatchObject({ status: 'PAID' });
  });
});
