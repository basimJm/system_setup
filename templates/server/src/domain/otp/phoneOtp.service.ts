import { ERROR_CODES } from '../../constants/errorCodes';
import type { Language } from '../../constants/i18n';
import { OTP_WRONG_CODE_DETAIL } from '../../constants/otp';
import type { OtpPurpose } from '../../constants/providers';
import type { OtpCodeRules, OtpProvider } from '../../providers/otp';
import { RateLimitError, UnauthorizedError } from '../../utils/errors';
import type { SettingsService } from '../settings';
import type { OtpGate, OtpRequestDecision } from './otpGate.service';

export interface PhoneOtpRequest {
  /** E.164. */
  readonly phone: string;
  readonly purpose: OtpPurpose;
  readonly language: Language;
  /** Client IP (trust-proxy aware); the provider forwards it only when configured (ARQAM_SEND_IP). */
  readonly ip?: string;
}

export interface PhoneOtpRequestAnswer extends OtpRequestDecision {
  /** Lifetime of the code just sent; 0 when no code was sent (`allowed: false`). */
  readonly expiresInSeconds: number;
}

export interface PhoneOtpVerified {
  /** Signed single-use proof for login / register / change phone. */
  readonly otpToken: string;
  readonly expiresInSeconds: number;
}

export interface PhoneOtpService {
  /** BUSINESS_DOMAIN §3.1a step 2: limits first, then the provider delivers the code. */
  request(input: PhoneOtpRequest): Promise<PhoneOtpRequestAnswer>;
  /** Step 3: wrong code → `OTP_INVALID` (counted, then `OTP_BLOCKED`); none/expired → `OTP_EXPIRED`. */
  verify(input: { phone: string; purpose: OtpPurpose; code: string }): Promise<PhoneOtpVerified>;
}

export interface PhoneOtpDeps {
  readonly gate: OtpGate;
  readonly otp: OtpProvider;
  readonly settings: Pick<SettingsService, 'get'>;
}

/**
 * The server-side phone OTP flow shared by the customer and merchant apps. Settings are read per
 * call, so an admin change of `otp.length`, `otp.codeTtlSec` or `otp.proofTtlSec` applies at once.
 */
export const createPhoneOtpService = ({ gate, otp, settings }: PhoneOtpDeps): PhoneOtpService => {
  const rules = async (): Promise<OtpCodeRules> => {
    const [codeLength, codeTtlSec, proofTtlSec] = await Promise.all([
      settings.get('otp.length'),
      settings.get('otp.codeTtlSec'),
      settings.get('otp.proofTtlSec'),
    ]);
    return { codeLength, codeTtlSec, proofTtlSec };
  };

  return {
    async request({ phone, purpose, language, ip }) {
      const decision = await gate.request(phone);
      if (!decision.allowed) return { ...decision, expiresInSeconds: 0 };
      // The request already counts: a delivery failure (422) or an outage (503) does not refund it.
      const sent = await otp.sendCode(
        { phone, purpose, language, ...(ip === undefined ? {} : { ip }) },
        await rules(),
      );
      return { ...decision, expiresInSeconds: sent.expiresInSeconds };
    },

    async verify({ phone, purpose, code }) {
      await gate.assertNotBlocked(phone);
      const result = await otp.verifyCode({ phone, purpose, code }, await rules());
      if (result.outcome !== 'VERIFIED') {
        if (result.outcome === 'EXPIRED') {
          throw new UnauthorizedError({ code: ERROR_CODES.OTP_EXPIRED });
        }
        const wrong = await gate.reportWrongAttempt(phone);
        if (wrong.blocked) throw new RateLimitError({ code: ERROR_CODES.OTP_BLOCKED });
        throw new UnauthorizedError({
          code: ERROR_CODES.OTP_INVALID,
          details: [
            {
              field: OTP_WRONG_CODE_DETAIL.field,
              code: ERROR_CODES.OTP_INVALID,
              messageKey: OTP_WRONG_CODE_DETAIL.messageKey,
              params: { attemptsRemaining: wrong.attemptsRemaining },
            },
          ],
        });
      }
      // A right code ends the wrong-code count and the resend countdown for this phone.
      await gate.reset(phone);
      return { otpToken: result.otpToken, expiresInSeconds: result.expiresInSeconds };
    },
  };
};
