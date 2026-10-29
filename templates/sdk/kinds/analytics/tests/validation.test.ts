import { ERROR_CODES } from '../src/constants/analytics';
import { assertEvent, assertLink } from '../src/validation';

const fails = (work: () => void): boolean => {
  try {
    work();
  } catch (error) {
    return (error as { code: string }).code === ERROR_CODES.VALIDATION_FAILED;
  }
  return false;
};

describe('validation', () => {
  it('checks events', () => {
    expect(
      fails(() => {
        assertEvent({
          name: 'booking_created',
          userId: 'u1',
          properties: { a: 1, b: 'x', c: true, d: null },
        });
        assertEvent({ name: 'app_open', anonymousId: 'anon-1', occurredAt: new Date() });
      }),
    ).toBe(false);
    const bad = [
      { name: 'Booking', userId: 'u' },
      { name: 'a', userId: 'u' },
      { name: 'ok_name' },
      { name: 'ok_name', userId: 'has space' },
      { name: 'ok_name', anonymousId: '' },
      { name: 'ok_name', userId: 'u', properties: { nested: { a: 1 } as unknown as string } },
      { name: 'ok_name', userId: 'u', properties: { big: 'x'.repeat(8_001) } },
      { name: 'ok_name', userId: 'u', occurredAt: new Date('nope') },
    ];
    for (const event of bad)
      expect(
        fails(() => {
          assertEvent(event);
        }),
      ).toBe(true);
  });

  it('checks identity links', () => {
    expect(
      fails(() => {
        assertLink({ anonymousId: 'anon-1', userId: 'u1' });
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertLink({ anonymousId: '', userId: 'u1' });
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertLink({ anonymousId: 'anon 1', userId: 'u1' });
      }),
    ).toBe(true);
  });
});
