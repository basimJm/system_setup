import { ERROR_CODES } from '../src/constants/notifications';
import {
  assertEmailMessage,
  assertIdempotencyKey,
  assertPushMessage,
  distinctTokens,
} from '../src/validation';

const fails = (work: () => unknown): boolean => {
  try {
    work();
  } catch (error) {
    return (error as { code: string }).code === ERROR_CODES.VALIDATION_FAILED;
  }
  return false;
};

describe('validation', () => {
  it('de-duplicates tokens and refuses empty lists', () => {
    expect(distinctTokens({ tokens: ['a', '', 'b', 'a'], body: 'x' })).toEqual(['a', 'b']);
    expect(fails(() => distinctTokens({ tokens: [], body: 'x' }))).toBe(true);
    expect(fails(() => distinctTokens({ tokens: 'a' as unknown as string[], body: 'x' }))).toBe(
      true,
    );
  });

  it('checks push messages', () => {
    expect(
      fails(() => {
        assertPushMessage({ tokens: ['a'], title: 't', data: { k: 'v' }, priority: 'high' });
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertPushMessage({ tokens: ['a'] });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertPushMessage({ tokens: ['a'], body: 'b', priority: 'urgent' as 'high' });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertPushMessage({ tokens: ['a'], data: { k: 1 as unknown as string } });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertPushMessage({ tokens: ['a'], data: { k: 'x'.repeat(4_001) } });
      }),
    ).toBe(true);
  });

  it('checks email messages and idempotency keys', () => {
    const email = { to: ['a@b.co'], subject: 's', text: 't' };
    expect(
      fails(() => {
        assertEmailMessage({ ...email, replyTo: 'r@b.co' });
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertEmailMessage({ ...email, to: [] });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertEmailMessage({ ...email, to: Array.from({ length: 51 }, () => 'a@b.co') });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertEmailMessage({ ...email, to: ['nope'] });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertEmailMessage({ ...email, subject: '' });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertEmailMessage({ ...email, text: '' });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertEmailMessage({ ...email, replyTo: 'nope' });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertIdempotencyKey(undefined);
        assertIdempotencyKey('k');
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertIdempotencyKey('');
      }),
    ).toBe(true);
  });
});
