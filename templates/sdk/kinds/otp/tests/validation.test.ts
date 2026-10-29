import { ERROR_CODES } from '../src/constants/otp';
import {
  assertCode,
  assertLanguage,
  assertPhone,
  assertPurpose,
  assertToken,
  isE164,
  maskPhone,
} from '../src/validation';

const fails = (work: () => void): boolean => {
  try {
    work();
  } catch (error) {
    return (error as { code: string }).code === ERROR_CODES.VALIDATION_FAILED;
  }
  return false;
};

describe('validation', () => {
  it('checks phones, purposes, languages, codes and tokens', () => {
    expect(isE164('+962791234567')).toBe(true);
    expect(isE164('0791234567')).toBe(false);
    expect(
      fails(() => {
        assertPhone('+962791234567');
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertPhone('+0');
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertPhone(1 as unknown as string);
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertPurpose('LOGIN');
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertPurpose('login');
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertLanguage('ar');
        assertLanguage('en-US');
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertLanguage('english');
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertCode('123456', 6);
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertCode('12345', 6);
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertCode('12345a', 6);
      }),
    ).toBe(true);
    expect(
      fails(() => {
        assertToken('a'.repeat(64));
      }),
    ).toBe(false);
    expect(
      fails(() => {
        assertToken('zz');
      }),
    ).toBe(true);
  });

  it('masks phones for logs', () => {
    expect(maskPhone('+962791234567')).toBe('+9627******67');
    expect(maskPhone('+1234')).toBe('***');
  });
});
