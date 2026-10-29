import type { OtpPurpose } from '../../src/constants/providers';
import { FakeOtpProvider } from '../../src/providers/otp';

/** One fake provider per test file: tokens issued here verify there (same secret and store). */
export const testOtp = new FakeOtpProvider();

/** A long-gone issue time: the token is past its `exp` when it is checked. */
const LONG_AGO = new Date('2020-01-01T00:00:00.000Z');

export type OtpTokenKind = 'valid' | 'expired' | 'invalid';

/**
 * An `otpToken` for tests: `valid` (as `POST …/auth/otp/verify` issues it), `expired` (issued long
 * ago) or `invalid` (signature broken). Each call is a fresh single-use proof.
 */
export const proofFor = (
  phone: string,
  purpose: OtpPurpose,
  kind: OtpTokenKind = 'valid',
): string => {
  if (kind === 'expired') return testOtp.issueToken(phone, purpose, { issuedAt: LONG_AGO });
  const token = testOtp.issueToken(phone, purpose);
  return kind === 'invalid' ? `${token}x` : token;
};
