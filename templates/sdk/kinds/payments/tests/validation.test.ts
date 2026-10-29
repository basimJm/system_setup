import { ERROR_CODES } from '../src/constants/payments';
import {
  assertAmount,
  assertCurrency,
  assertId,
  assertRefundRequest,
  assertSessionRequest,
} from '../src/validation';
import { sessionRequest } from './helpers/fixtures';

const fails = (work: () => void): boolean => {
  try {
    work();
  } catch (error) {
    return (error as { code: string }).code === ERROR_CODES.VALIDATION_FAILED;
  }
  return false;
};

describe('validation', () => {
  it('checks ids, amounts and currencies', () => {
    expect(
      fails(() => {
        assertId('a-b_c:1', 'x');
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertId('a b', 'x');
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertId('', 'x');
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertAmount(1);
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertAmount(0);
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertAmount(1.5);
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertCurrency('JOD', []);
        assertCurrency('JOD', ['JOD']);
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertCurrency('USD', ['JOD']);
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertCurrency('jod', []);
      }),
    ).toBe(true);
  });

  it('checks a session request field by field', () => {
    expect(
      fails(() => {
        assertSessionRequest(
          sessionRequest({
            cancelUrl: 'https://app.example.test/cancel',
            metadata: { a: '1' },
            destinations: [{ accountId: 'acc-1', amount: 10_000 }],
          }),
          ['JOD'],
        );
      }),
    ).toBe(false);
    const bad: Parameters<typeof sessionRequest>[0][] = [
      { orderId: '' },
      { idempotencyKey: 'has space' },
      { amount: -1 },
      { currency: 'US' },
      { customer: { id: '' } },
      { returnUrl: undefined as unknown as string },
      { returnUrl: 'not a url' },
      { cancelUrl: 'nope' },
      { metadata: { a: 1 as unknown as string } },
      { metadata: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [String(i), 'v'])) },
      { destinations: [{ accountId: 'acc', amount: 20_000 }] },
      { destinations: [{ accountId: '', amount: 1 }] },
    ];
    for (const overrides of bad)
      expect(
        fails(() => {
          assertSessionRequest(sessionRequest(overrides), []);
        }),
      ).toBe(true);
  });

  it('checks a refund request', () => {
    const refund = { sessionId: 'sess_1', reason: 'customer cancelled', idempotencyKey: 'r1' };
    expect(
      fails(() => {
        assertRefundRequest(refund);
        assertRefundRequest({ ...refund, amount: 5 });
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertRefundRequest({ ...refund, reason: '' });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertRefundRequest({ ...refund, amount: 0 });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertRefundRequest({ ...refund, sessionId: '' });
      }),
    ).toBe(true);
  });
});
