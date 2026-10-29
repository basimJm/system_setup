import { KERNEL_ERROR_CODES } from './codes';

export const ERROR_CODES = {
  ...KERNEL_ERROR_CODES,
  DELIVERY_FAILED: '__SDK_PREFIX___DELIVERY_FAILED',
  STORE_FAILED: '__SDK_PREFIX___STORE_FAILED',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** `fake` = memory store + fake channel (dev/tests); `code` = the consumer injects store + channel. */
export const PROVIDERS = ['fake', 'code'] as const;
export type ProviderName = (typeof PROVIDERS)[number];
export const DEV_ONLY_PROVIDERS: readonly ProviderName[] = ['fake'];

export const REQUEST_OUTCOMES = ['SENT', 'RATE_LIMITED', 'BLOCKED'] as const;
export type RequestOutcome = (typeof REQUEST_OUTCOMES)[number];

export const VERIFY_OUTCOMES = ['VERIFIED', 'WRONG_CODE', 'EXPIRED', 'BLOCKED'] as const;
export type VerifyOutcome = (typeof VERIFY_OUTCOMES)[number];

export const CONSUME_REASONS = ['UNKNOWN_TOKEN', 'MISMATCH'] as const;
export type ConsumeReason = (typeof CONSUME_REASONS)[number];

export const DEFAULTS = {
  codeLength: 6,
  codeTtlSec: 300,
  resendAfterSec: 60,
  tokenTtlSec: 600,
  limits: { requests: 5, windowSec: 300, wrongCodes: 5, blockSec: 900 },
} as const;
export const MIN_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 10;
export const MIN_SECRET_LENGTH = 32;
export const TOKEN_BYTES = 32;

/** Store key prefixes; one namespace per concern so a shared store can be inspected. */
export const KEYS = {
  code: 'code',
  requests: 'req',
  wrong: 'wrong',
  block: 'block',
  cooldown: 'cooldown',
  token: 'token',
} as const;
export const KEY_SEPARATOR = ':';

export const E164_PATTERN = /^\+[1-9]\d{6,14}$/;
export const PURPOSE_PATTERN = /^[A-Z][A-Z0-9_]{1,31}$/;
export const LANGUAGE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
