import { ERROR_CODES } from '../src/constants/payments';
import { signWebhook, verifyWebhook } from '../src/webhook';
import { SECRET, START } from './helpers/fixtures';

const body = JSON.stringify({
  eventId: 'evt_1',
  type: 'PAYMENT_PAID',
  sessionId: 'sess_1',
  occurredAt: START.toISOString(),
  data: { reference: 'ref_1' },
});

const codeOf = async (work: () => unknown): Promise<string | undefined> => {
  try {
    await work();
  } catch (error) {
    return (error as { code: string }).code;
  }
  return undefined;
};

describe('webhook', () => {
  it('signs and verifies, accepting header arrays, Buffers and any header case', () => {
    const headers = signWebhook(SECRET, body, START);
    expect(headers['x-signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    const event = verifyWebhook(SECRET, { headers, rawBody: body }, START, 300);
    expect(event).toEqual({
      eventId: 'evt_1',
      type: 'PAYMENT_PAID',
      sessionId: 'sess_1',
      occurredAt: START,
      data: { reference: 'ref_1' },
    });
    const upper = { 'X-Signature': [headers['x-signature'] ?? ''] };
    expect(
      verifyWebhook(SECRET, { headers: upper, rawBody: Buffer.from(body) }, START, 300).eventId,
    ).toBe('evt_1');
  });

  it('normalises unknown types, bad dates and missing data', () => {
    const odd = JSON.stringify({
      eventId: 'e',
      type: 'SOMETHING_NEW',
      sessionId: 's',
      occurredAt: 'nope',
      data: [1],
    });
    const event = verifyWebhook(
      SECRET,
      { headers: signWebhook(SECRET, odd, START), rawBody: odd },
      START,
      300,
    );
    expect(event).toEqual({
      eventId: 'e',
      type: 'UNKNOWN',
      sessionId: 's',
      occurredAt: START,
      data: {},
    });
  });

  it('rejects missing, malformed, wrong, stale and non-JSON webhooks', async () => {
    const headers = signWebhook(SECRET, body, START);
    expect(
      await codeOf(() => verifyWebhook(SECRET, { headers: {}, rawBody: body }, START, 300)),
    ).toBe(ERROR_CODES.WEBHOOK_INVALID);
    expect(
      await codeOf(() =>
        verifyWebhook(SECRET, { headers: { 'x-signature': 'garbage' }, rawBody: body }, START, 300),
      ),
    ).toBe(ERROR_CODES.WEBHOOK_INVALID);
    expect(
      await codeOf(() =>
        verifyWebhook(
          SECRET,
          { headers: { 'x-signature': 't=abc,v1=00' }, rawBody: body },
          START,
          300,
        ),
      ),
    ).toBe(ERROR_CODES.WEBHOOK_INVALID);
    expect(await codeOf(() => verifyWebhook('other', { headers, rawBody: body }, START, 300))).toBe(
      ERROR_CODES.AUTH_FAILED,
    );
    expect(
      await codeOf(() => verifyWebhook(SECRET, { headers, rawBody: `${body} ` }, START, 300)),
    ).toBe(ERROR_CODES.AUTH_FAILED);
    const later = new Date(START.getTime() + 301_000);
    expect(await codeOf(() => verifyWebhook(SECRET, { headers, rawBody: body }, later, 300))).toBe(
      ERROR_CODES.WEBHOOK_INVALID,
    );
    const notJson = 'not json';
    expect(
      await codeOf(() =>
        verifyWebhook(
          SECRET,
          { headers: signWebhook(SECRET, notJson, START), rawBody: notJson },
          START,
          300,
        ),
      ),
    ).toBe(ERROR_CODES.MALFORMED_RESPONSE);
    const incomplete = JSON.stringify({ eventId: 'e' });
    expect(
      await codeOf(() =>
        verifyWebhook(
          SECRET,
          { headers: signWebhook(SECRET, incomplete, START), rawBody: incomplete },
          START,
          300,
        ),
      ),
    ).toBe(ERROR_CODES.WEBHOOK_INVALID);
  });
});
