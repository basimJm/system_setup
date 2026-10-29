import { ERROR_CODES, errorMessageKey } from '../../constants/errorCodes';
import { FIELD_INVALID_CODE } from '../../constants/customerAuth';
import type { OtpPurpose } from '../../constants/providers';
import type { OtpProvider } from '../../providers';
import { UnauthorizedError, type ErrorDetail } from '../../utils/errors';
import type { OtpGate } from '../otp/otpGate.service';

export interface PhoneVerifier {
  /** Blocked numbers cannot try again; then the provider must confirm this very number. */
  verify(e164: string, otpToken: string, purpose: OtpPurpose): Promise<void>;
}

export interface PhoneVerifierDeps {
  readonly otp: OtpProvider;
  readonly otpGate: OtpGate;
}

export const invalidField = (field: string): ErrorDetail => ({
  field,
  code: FIELD_INVALID_CODE,
  messageKey: errorMessageKey(ERROR_CODES.VALIDATION_ERROR),
});

/** Phone-proof handling shared by the customer and merchant sign-in flows. */
export const createPhoneVerifier = ({ otp, otpGate }: PhoneVerifierDeps): PhoneVerifier => ({
  async verify(e164, otpToken, purpose) {
    await otpGate.assertNotBlocked(e164);
    const result = await otp.verify({ proof: otpToken, expectedPhone: e164, purpose });
    if (result.outcome === 'VERIFIED') return;
    throw new UnauthorizedError({
      code: result.outcome === 'EXPIRED' ? ERROR_CODES.OTP_EXPIRED : ERROR_CODES.OTP_INVALID,
    });
  },
});
