import { z } from 'zod';
import { REFRESH_TOKEN_PATTERN } from '../../../constants/auth';
import {
  EMAIL_MAX_LENGTH,
  PERSON_NAME_MAX_LENGTH,
  PERSON_NAME_MIN_LENGTH,
  PUSH_TOKEN_MAX_LENGTH,
} from '../../../constants/identity';
import { OTP_TOKEN_MAX_LENGTH } from '../../../constants/otp';
import { E164_PATTERN, EMAIL_PATTERN } from '../../../constants/providers';

/** Request pieces shared by the customer and merchant sign-in routes. */
export const phoneSchema = z.string().regex(E164_PATTERN);
/** The signed single-use proof from `POST …/auth/otp/verify`. */
export const otpTokenSchema = z.string().min(1).max(OTP_TOKEN_MAX_LENGTH);
export const refreshTokenSchema = z.string().regex(REFRESH_TOKEN_PATTERN);
export const pushTokenSchema = z.string().min(1).max(PUSH_TOKEN_MAX_LENGTH).optional();
export const personNameSchema = z
  .string()
  .trim()
  .min(PERSON_NAME_MIN_LENGTH)
  .max(PERSON_NAME_MAX_LENGTH);
export const emailSchema = z.string().trim().max(EMAIL_MAX_LENGTH).regex(EMAIL_PATTERN);
