import { FakeGateway, ledgerError } from '../src/adapters/fake';
import { resolveConfig } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/payments';
import { Ledger } from '../src/mock/ledger';
import { SECRET, START, sequentialIds, sessionRequest } from './helpers/fixtures';

const build = (): { gateway: FakeGateway; tick: (ms: number) => void } => {
  let now = START.getTime();
  const config = resolveConfig({
    environment: 'dev',
    provider: 'fake',
    webhookSecret: SECRET,
    currencies: ['KWD'],
    sessionTtlSec: 60,
    now: () => new Date(now),
  });
  const ledger = new Ledger({
    webhookSecret: SECRET,
    sessionTtlSec: 60,
    checkoutUrl: 'http://localhost/checkout',
    now: () => new Date(now),
    idGenerator: sequentialIds(),
  });
  return {
    gateway: new FakeGateway(config, ledger),
    tick: (ms) => {
      now += ms;
    },
  };
};

describe('FakeGateway', () => {
  it('runs create → settle → verify → webhook → refund with idempotency', async () => {
    const { gateway } = build();
    const session = await gateway.createSession(sessionRequest());
    expect(session).toEqual({
      sessionId: 'sess_1',
      redirectUrl: 'http://localhost/checkout/sess_1',
      expiresAt: new Date(START.getTime() + 60_000),
      status: 'PENDING',
    });
    await expect(gateway.createSession(sessionRequest())).resolves.toEqual(session);
    await expect(gateway.createSession(sessionRequest({ amount: 1 }))).rejects.toMatchObject({
      code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
    });
    await expect(gateway.verify('sess_1')).resolves.toEqual({
      sessionId: 'sess_1',
      status: 'PENDING',
      amount: 12_500,
      currency: 'KWD',
    });
    const webhook = gateway.settle('sess_1', 'PAID');
    const event = await gateway.parseWebhook({ headers: webhook.headers, rawBody: webhook.body });
    expect(event).toMatchObject({
      type: 'PAYMENT_PAID',
      sessionId: 'sess_1',
      data: { status: 'PAID', reference: 'ref_2' },
    });
    await expect(gateway.verify('sess_1')).resolves.toEqual({
      sessionId: 'sess_1',
      status: 'PAID',
      amount: 12_500,
      currency: 'KWD',
      paidAt: START,
      reference: 'ref_2',
    });
    const refund = { sessionId: 'sess_1', amount: 2_500, reason: 'partial', idempotencyKey: 'r1' };
    await expect(gateway.refund(refund)).resolves.toEqual({
      refundId: 'rf_4',
      status: 'REFUNDED',
      amount: 2_500,
    });
    await expect(gateway.refund(refund)).resolves.toEqual({
      refundId: 'rf_4',
      status: 'REFUNDED',
      amount: 2_500,
    });
    await expect(gateway.refund({ ...refund, amount: 1 })).rejects.toMatchObject({
      code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
    });
    await expect(
      gateway.refund({ ...refund, amount: 10_001, idempotencyKey: 'r2' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.REFUND_NOT_ALLOWED,
    });
    await expect(
      gateway.refund({ sessionId: 'sess_1', reason: 'rest', idempotencyKey: 'r3' }),
    ).resolves.toMatchObject({
      amount: 10_000,
    });
    await expect(gateway.verify('sess_1')).resolves.toMatchObject({ status: 'REFUNDED' });
    await expect(
      gateway.refund({ sessionId: 'sess_1', reason: 'again', idempotencyKey: 'r4' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.REFUND_NOT_ALLOWED,
    });
    expect(gateway.ledger.size).toBe(1);
    await gateway.close();
  });

  it('expires pending sessions, refuses settling twice and unknown sessions', async () => {
    const { gateway, tick } = build();
    await gateway.createSession(sessionRequest());
    tick(60_000);
    await expect(gateway.verify('sess_1')).resolves.toMatchObject({ status: 'EXPIRED' });
    expect(() => gateway.settle('sess_1', 'PAID')).toThrow(
      expect.objectContaining({ code: ERROR_CODES.VENDOR_ERROR }) as Error,
    );
    expect(() => gateway.settle('sess_9', 'PAID')).toThrow(
      expect.objectContaining({ code: ERROR_CODES.SESSION_NOT_FOUND }) as Error,
    );
    await expect(gateway.verify('sess_9')).rejects.toMatchObject({
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
    await expect(
      gateway.refund({ sessionId: 'sess_1', reason: 'x', idempotencyKey: 'r' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.REFUND_NOT_ALLOWED,
    });
    await expect(
      gateway.refund({ sessionId: 'sess_9', reason: 'x', idempotencyKey: 'r9' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SESSION_NOT_FOUND,
    });
    const failed = await gateway.createSession(
      sessionRequest({ idempotencyKey: 'k2', orderId: 'order-2' }),
    );
    const webhook = gateway.settle(failed.sessionId, 'FAILED');
    await expect(
      gateway.parseWebhook({ headers: webhook.headers, rawBody: webhook.body }),
    ).resolves.toMatchObject({
      type: 'PAYMENT_FAILED',
    });
  });

  it('validates, injects failures and uses its own ledger by default', async () => {
    const { gateway } = build();
    await expect(gateway.createSession(sessionRequest({ currency: 'USD' }))).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
    await expect(gateway.verify('')).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
    await expect(gateway.parseWebhook({ headers: {}, rawBody: '{}' })).rejects.toMatchObject({
      code: ERROR_CODES.WEBHOOK_INVALID,
    });
    gateway.failWith = new Error('injected');
    await expect(gateway.verify('sess_1')).rejects.toThrow('injected');
    const own = new FakeGateway(
      resolveConfig({ environment: 'dev', provider: 'fake', webhookSecret: SECRET }),
    );
    const session = await own.createSession(sessionRequest());
    expect(session.redirectUrl).toMatch(/^http:\/\/localhost\/checkout\/sess_[0-9a-f]{16}$/);
    own.ledger.clear();
    expect(own.ledger.size).toBe(0);
    expect(ledgerError('INVALID').code).toBe(ERROR_CODES.VENDOR_ERROR);
  });
});
