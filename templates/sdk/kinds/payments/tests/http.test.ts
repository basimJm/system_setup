import { HttpGateway, mapStatus } from '../src/adapters/http';
import { resolveConfig, type PaymentsOptions } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/payments';
import type { Logger } from '../src/logger';
import { MockGateway } from '../src/mock/gateway';
import {
  API_KEY,
  SECRET,
  START,
  fetchVia,
  instant,
  sequentialIds,
  sessionRequest,
} from './helpers/fixtures';

const build = (
  overrides: Partial<PaymentsOptions> = {},
  logger?: Logger,
): { gateway: HttpGateway; mock: MockGateway; calls: string[] } => {
  const mock = new MockGateway({
    apiKey: API_KEY,
    webhookSecret: SECRET,
    sessionTtlSec: 60,
    checkoutUrl: 'http://localhost:4242/pay',
    now: () => START,
    idGenerator: sequentialIds(),
  });
  const calls: string[] = [];
  const config = resolveConfig({
    environment: 'dev',
    provider: 'http',
    webhookSecret: SECRET,
    http: { baseUrl: 'http://localhost:4242', apiKey: API_KEY },
    retry: { maxAttempts: 2 },
    timeoutMs: 50,
    now: () => START,
    fetch: fetchVia(mock, calls),
    ...overrides,
    ...(logger ? { logger } : {}),
  });
  const http = config.http ?? { baseUrl: 'http://localhost:4242', apiKey: API_KEY };
  return {
    gateway: new HttpGateway(
      { ...config, http },
      { fetch: config.fetch ?? fetchVia(mock), retryDeps: instant },
    ),
    mock,
    calls,
  };
};

describe('mapStatus', () => {
  it('maps wire codes first, then HTTP statuses', () => {
    expect(mapStatus(200, undefined)).toBe('ok');
    expect(mapStatus(201, undefined)).toBe('ok');
    const codes = [
      [404, 'NOT_FOUND'],
      [409, 'IDEMPOTENCY_CONFLICT'],
      [409, 'REFUND_NOT_ALLOWED'],
      [401, 'UNAUTHORIZED'],
      [403, undefined],
      [404, undefined],
      [429, undefined],
      [502, undefined],
      [400, undefined],
      [422, 'INVALID_REQUEST'],
      [409, undefined],
      [302, undefined],
    ].map(([status, wire]) => {
      const mapped = mapStatus(status as number, wire as string | undefined);
      return mapped === 'ok' ? 'ok' : [mapped.code, mapped.retryable];
    });
    expect(codes).toEqual([
      [ERROR_CODES.SESSION_NOT_FOUND, false],
      [ERROR_CODES.IDEMPOTENCY_CONFLICT, false],
      [ERROR_CODES.REFUND_NOT_ALLOWED, false],
      [ERROR_CODES.AUTH_FAILED, false],
      [ERROR_CODES.AUTH_FAILED, false],
      [ERROR_CODES.SESSION_NOT_FOUND, false],
      [ERROR_CODES.RATE_LIMITED, true],
      [ERROR_CODES.UNAVAILABLE, true],
      [ERROR_CODES.VENDOR_ERROR, false],
      [ERROR_CODES.VENDOR_ERROR, false],
      [ERROR_CODES.VENDOR_ERROR, false],
      [ERROR_CODES.UNKNOWN, false],
    ]);
  });
});

describe('HttpGateway', () => {
  it('runs the full flow against the mock protocol', async () => {
    const { gateway, mock, calls } = build();
    const session = await gateway.createSession(sessionRequest());
    expect(session).toEqual({
      sessionId: 'sess_1',
      redirectUrl: 'http://localhost:4242/pay/sess_1',
      expiresAt: new Date(START.getTime() + 60_000),
      status: 'PENDING',
    });
    await expect(gateway.createSession(sessionRequest())).resolves.toEqual(session);
    const webhook = mock.ledger.settle('sess_1', 'PAID');
    if (typeof webhook === 'string') throw new Error(webhook);
    await expect(
      gateway.parseWebhook({ headers: webhook.headers, rawBody: webhook.body }),
    ).resolves.toMatchObject({
      type: 'PAYMENT_PAID',
      sessionId: 'sess_1',
    });
    await expect(gateway.verify('sess_1')).resolves.toEqual({
      sessionId: 'sess_1',
      status: 'PAID',
      amount: 12_500,
      currency: 'JOD',
      paidAt: START,
      reference: 'ref_2',
    });
    await expect(
      gateway.refund({ sessionId: 'sess_1', reason: 'cancel', idempotencyKey: 'r1' }),
    ).resolves.toEqual({
      refundId: 'rf_4',
      status: 'REFUNDED',
      amount: 12_500,
    });
    expect(calls).toEqual([
      'POST /v1/sessions',
      'POST /v1/sessions',
      'GET /v1/sessions/sess_1',
      'POST /v1/refunds',
    ]);
    await gateway.close();
  });

  it('maps gateway refusals and retries transient ones', async () => {
    const warnings: unknown[] = [];
    const logger: Logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: (m, f) => warnings.push([m, f]),
      error: () => undefined,
    };
    const { gateway, mock } = build({}, logger);
    await expect(gateway.verify('sess_9')).rejects.toMatchObject({
      code: ERROR_CODES.SESSION_NOT_FOUND,
      details: { status: 404 },
    });
    await expect(
      gateway.refund({ sessionId: 'sess_9', reason: 'x', idempotencyKey: 'r' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
    mock.nextStatus.push(503);
    await expect(gateway.createSession(sessionRequest())).resolves.toMatchObject({
      sessionId: 'sess_1',
    });
    mock.nextStatus.push(503, 503);
    await expect(gateway.verify('sess_1')).rejects.toMatchObject({
      code: ERROR_CODES.UNAVAILABLE,
      retryable: true,
    });
    expect(warnings).toEqual([
      ['gateway request failed', { method: 'GET', path: '/sessions/sess_9', status: 404 }],
      ['gateway request failed', { method: 'POST', path: '/refunds', status: 404 }],
      ['gateway request failed', { method: 'POST', path: '/sessions', status: 503 }],
      ['gateway request failed', { method: 'GET', path: '/sessions/sess_1', status: 503 }],
      ['gateway request failed', { method: 'GET', path: '/sessions/sess_1', status: 503 }],
    ]);
    const wrongKey = build({ http: { baseUrl: 'http://localhost:4242', apiKey: 'other' } });
    await expect(wrongKey.gateway.verify('sess_1')).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_FAILED,
    });
    await expect(gateway.createSession(sessionRequest({ amount: 0 }))).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    await expect(gateway.parseWebhook({ headers: {}, rawBody: '' })).rejects.toMatchObject({
      code: ERROR_CODES.WEBHOOK_INVALID,
    });
  });

  it('never trusts malformed or unknown answers', async () => {
    const warnings: unknown[] = [];
    const logger: Logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: (m) => warnings.push(m),
      error: () => undefined,
    };
    const answers: { status: number; text: string }[] = [];
    const { gateway } = build(
      {
        fetch: () =>
          Promise.resolve({
            status: answers[0]?.status ?? 200,
            text: () => Promise.resolve(answers.shift()?.text ?? ''),
          }),
      },
      logger,
    );
    answers.push({ status: 200, text: 'nope' });
    await expect(gateway.verify('s')).rejects.toMatchObject({
      code: ERROR_CODES.MALFORMED_RESPONSE,
    });
    answers.push({ status: 200, text: '' });
    await expect(gateway.verify('s')).rejects.toMatchObject({
      code: ERROR_CODES.MALFORMED_RESPONSE,
    });
    answers.push({ status: 200, text: '[1]' });
    await expect(gateway.createSession(sessionRequest())).rejects.toMatchObject({
      code: ERROR_CODES.MALFORMED_RESPONSE,
    });
    answers.push({ status: 200, text: JSON.stringify({ refundId: 'x' }) });
    await expect(
      gateway.refund({ sessionId: 's', reason: 'r', idempotencyKey: 'k' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.MALFORMED_RESPONSE,
    });
    answers.push({
      status: 200,
      text: JSON.stringify({
        sessionId: 's',
        amount: 1,
        currency: 'JOD',
        status: 'WEIRD',
        paidAt: 'nope',
      }),
    });
    await expect(gateway.verify('s')).resolves.toMatchObject({ status: 'UNKNOWN' });
    answers.push({
      status: 200,
      text: JSON.stringify({
        sessionId: 's',
        redirectUrl: 'http://x',
        expiresAt: START.toISOString(),
        status: 'ODD',
      }),
    });
    await expect(gateway.createSession(sessionRequest())).resolves.toMatchObject({
      status: 'UNKNOWN',
    });
    answers.push({
      status: 200,
      text: JSON.stringify({ refundId: 'x', amount: 1, status: 'ODD' }),
    });
    await expect(
      gateway.refund({ sessionId: 's', reason: 'r', idempotencyKey: 'k' }),
    ).resolves.toMatchObject({ status: 'UNKNOWN' });
    expect(warnings).toEqual([
      'unknown payment status',
      'unknown payment status',
      'unknown refund status',
    ]);
  });

  it('wraps network errors and timeouts', async () => {
    const down = build({ fetch: () => Promise.reject(new Error('ECONNREFUSED')) });
    await expect(down.gateway.verify('s')).rejects.toMatchObject({
      code: ERROR_CODES.NETWORK_ERROR,
      retryable: true,
    });
    const slow = build({ fetch: () => new Promise(() => undefined), retry: { maxAttempts: 1 } });
    await expect(slow.gateway.verify('s')).rejects.toMatchObject({ code: ERROR_CODES.TIMEOUT });
  });
});
