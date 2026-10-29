import { z } from 'zod';
import {
  CUSTOMER_OTP_PURPOSES,
  MERCHANT_OTP_PURPOSES,
  OTP_CODE_PATTERN,
} from '../../../constants/otp';
import { E164_PATTERN } from '../../../constants/providers';

const phone = z.string().regex(E164_PATTERN);
const code = z.string().regex(OTP_CODE_PATTERN);

export const customerOtpRequestSchema = z.object({
  phone,
  purpose: z.enum(CUSTOMER_OTP_PURPOSES),
});
export const merchantOtpRequestSchema = z.object({
  phone,
  purpose: z.enum(MERCHANT_OTP_PURPOSES),
});
export const customerOtpVerifySchema = customerOtpRequestSchema.extend({ code });
export const merchantOtpVerifySchema = merchantOtpRequestSchema.extend({ code });

/** The customer and merchant apps accept different purposes; the shapes are otherwise the same. */
export interface OtpSchemas {
  readonly request: typeof customerOtpRequestSchema | typeof merchantOtpRequestSchema;
  readonly verify: typeof customerOtpVerifySchema | typeof merchantOtpVerifySchema;
}
export const CUSTOMER_OTP_SCHEMAS: OtpSchemas = {
  request: customerOtpRequestSchema,
  verify: customerOtpVerifySchema,
};
export const MERCHANT_OTP_SCHEMAS: OtpSchemas = {
  request: merchantOtpRequestSchema,
  verify: merchantOtpVerifySchema,
};
