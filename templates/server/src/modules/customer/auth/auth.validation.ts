import { z } from 'zod';
import { PHONE_CHECK_PURPOSES } from '../../../constants/customerAuth';
import {
  emailSchema,
  otpTokenSchema as otpToken,
  personNameSchema,
  phoneSchema as phone,
  pushTokenSchema as pushToken,
  refreshTokenSchema as refreshToken,
} from '../../shared/auth/auth.schemas';

export const checkPhoneSchema = z.object({ phone, purpose: z.enum(PHONE_CHECK_PURPOSES) });
export const loginSchema = z.object({ phone, otpToken, pushToken });
export const registerSchema = z.object({
  name: personNameSchema,
  email: emailSchema.optional(),
  phone,
  otpToken,
  pushToken,
});
export const refreshSchema = z.object({ refreshToken });
export const changePhoneSchema = z.object({ phone, otpToken });
