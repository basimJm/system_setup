import { z } from 'zod';
import { PHONE_CHECK_PURPOSES } from '../../../constants/customerAuth';
import {
  BUSINESS_NAME_MAX_LENGTH,
  BUSINESS_NAME_MIN_LENGTH,
} from '../../../constants/merchantAuth';
import {
  otpTokenSchema as otpToken,
  personNameSchema,
  phoneSchema as phone,
  pushTokenSchema as pushToken,
  refreshTokenSchema as refreshToken,
} from '../../shared/auth/auth.schemas';

export const checkPhoneSchema = z.object({ phone, purpose: z.enum(PHONE_CHECK_PURPOSES) });
export const registerSchema = z.object({
  businessName: z.string().trim().min(BUSINESS_NAME_MIN_LENGTH).max(BUSINESS_NAME_MAX_LENGTH),
  name: personNameSchema,
  phone,
  otpToken,
  pushToken,
});
export const loginSchema = z.object({ phone, otpToken, pushToken });
export const refreshSchema = z.object({ refreshToken });
