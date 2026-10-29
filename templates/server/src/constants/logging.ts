/** Logging and request-id constants. */
export const SERVICE_NAME = '__SYSTEM_SLUG__-server';

export const REDACTION_PLACEHOLDER = '[REDACTED]';
export const MASK_CHARACTER = '*';
/** Digits kept visible when a phone number is masked. */
export const PHONE_VISIBLE_DIGITS = 3;
export const MAX_REDACTION_DEPTH = 8;
export const CIRCULAR_PLACEHOLDER = '[Circular]';
export const TRUNCATED_PLACEHOLDER = '[Truncated]';

/** Key names are compared lower-cased with `_` and `-` removed. */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'setcookie',
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'pushtoken',
  'otp',
  'secret',
  'apikey',
]);

/** Values under these keys are masked (last digits kept) instead of removed. */
export const PHONE_KEYS: ReadonlySet<string> = new Set([
  'phone',
  'phonenumber',
  'mobile',
  'whatsapp',
  'e164',
]);

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_MAX_LENGTH = 64;
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
