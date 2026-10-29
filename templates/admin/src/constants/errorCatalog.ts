import type { ErrorKind } from './errors';

/**
 * Every server error code (the `ErrorResponse.error.code` enum of the contract) and how the panel treats it.
 * `tests/errorCatalog.test.ts` keeps this list equal to the OpenAPI enum (and to the server's `BUSINESS_DOMAIN.md`
 * §11 when that document exists next to this project) and requires a message for each code in both locales
 * (`errors.codes.<CODE>`).
 */
export const ERROR_CODE_KIND = {
  VALIDATION_ERROR: 'validation',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  PERMISSION_DENIED: 'forbidden',
  NOT_FOUND: 'notFound',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rateLimited',
  INTERNAL: 'server',
  OTP_BLOCKED: 'rateLimited',
  OTP_INVALID: 'validation',
  OTP_EXPIRED: 'validation',
  OTP_DELIVERY_FAILED: 'validation',
  PHONE_NOT_REGISTERED: 'notFound',
  PHONE_ALREADY_REGISTERED: 'conflict',
  ACCOUNT_BLOCKED: 'forbidden',
  MEMBER_INACTIVE: 'forbidden',
  OWNER_REQUIRED: 'forbidden',
  PAYMENT_FAILED: 'conflict',
  UPLOAD_INVALID: 'validation',
  UPLOAD_TOO_LARGE: 'validation',
  ITEM_NOT_FOUND: 'notFound',
  ITEM_ARCHIVED: 'conflict',
  ITEM_LIMIT_REACHED: 'conflict',
} as const satisfies Record<string, ErrorKind>;

export type ErrorCode = keyof typeof ERROR_CODE_KIND;
export const ERROR_CODES = Object.keys(ERROR_CODE_KIND) as ErrorCode[];
export const ERROR_CODE_MESSAGE_PREFIX = 'errors.codes.';

export const isErrorCode = (code: unknown): code is ErrorCode =>
  typeof code === 'string' && Object.hasOwn(ERROR_CODE_KIND, code);
