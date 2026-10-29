import type { Language } from '../../constants/i18n';
import type { OtpCodeOutcome, OtpOutcome, OtpPurpose } from '../../constants/providers';

/** Per-call code rules, read from settings so an admin change applies at once (§10 `otp.*`). */
export interface OtpCodeRules {
  /** `otp.length` digits. */
  readonly codeLength: number;
  /** `otp.codeTtlSec`. */
  readonly codeTtlSec: number;
  /** `otp.proofTtlSec`: lifetime of the `otpToken` issued after a right code. */
  readonly proofTtlSec: number;
}

export interface OtpSendInput {
  /** E.164. */
  readonly phone: string;
  readonly purpose: OtpPurpose;
  /** Picks the ARQAM template (`Accept-Language`). */
  readonly language: Language;
  /** End user's IP (trust-proxy aware); forwarded only by providers configured to send it. */
  readonly ip?: string;
}

export interface OtpCodeInput {
  readonly phone: string;
  readonly purpose: OtpPurpose;
  /** What the user typed. */
  readonly code: string;
}

/** A right code yields the signed single-use proof the phone-verified actions take. */
export type OtpCodeResult =
  | {
      readonly outcome: Extract<OtpCodeOutcome, 'VERIFIED'>;
      readonly otpToken: string;
      readonly expiresInSeconds: number;
    }
  | { readonly outcome: Exclude<OtpCodeOutcome, 'VERIFIED'> };

export interface OtpVerifyInput {
  /** The `otpToken` from `POST …/auth/otp/verify`. */
  readonly proof: string;
  /** The phone the user claims to own, in E.164. */
  readonly expectedPhone: string;
  readonly purpose: OtpPurpose;
}

/** `VERIFIED` carries the phone the proof was issued for (equal to `expectedPhone`). */
export type OtpVerifyResult =
  | { readonly outcome: Extract<OtpOutcome, 'VERIFIED'>; readonly phone: string }
  | { readonly outcome: Exclude<OtpOutcome, 'VERIFIED'> };

/**
 * Phone OTP (BUSINESS_DOMAIN §3.1a): the server generates and delivers the code, checks it and
 * issues a signed single-use `otpToken`; every phone-verified action checks that token. Request
 * limits, blocks and counters stay with the backend (OtpGate). A channel outage throws
 * `ExternalServiceError`; a recipient ARQAM/WhatsApp refuses throws `OTP_DELIVERY_FAILED` (422).
 */
export interface OtpProvider {
  /** Sends a new code (replacing an earlier one); answers the code lifetime in seconds. */
  sendCode(
    input: OtpSendInput,
    rules: OtpCodeRules,
  ): Promise<{ readonly expiresInSeconds: number }>;
  /** Checks a typed code; a right code is deleted (single use). */
  verifyCode(input: OtpCodeInput, rules: OtpCodeRules): Promise<OtpCodeResult>;
  /** Checks an `otpToken`: signature, expiry, phone, purpose and single use. */
  verify(input: OtpVerifyInput): Promise<OtpVerifyResult>;
}
