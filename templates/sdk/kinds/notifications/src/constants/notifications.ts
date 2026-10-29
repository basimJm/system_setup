import { KERNEL_ERROR_CODES } from './codes';

export const ERROR_CODES = {
  ...KERNEL_ERROR_CODES,
  PUSH_FAILED: '__SDK_PREFIX___PUSH_FAILED',
  EMAIL_FAILED: '__SDK_PREFIX___EMAIL_FAILED',
  DUPLICATE: '__SDK_PREFIX___DUPLICATE',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** `fake` records messages; `custom` = the consumer injects a sender (vendor adapter). */
export const PROVIDERS = ['fake', 'custom'] as const;
export type ProviderName = (typeof PROVIDERS)[number];
export const DEV_ONLY_PROVIDERS: readonly ProviderName[] = ['fake'];

export const CHANNELS = ['push', 'email'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Per-token outcome of a push; every vendor code maps to one of these. */
export const TOKEN_STATUSES = ['SENT', 'INVALID_TOKEN', 'RETRYABLE', 'FAILED'] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

export const EMAIL_STATUSES = ['SENT', 'QUEUED'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const PRIORITIES = ['high', 'normal'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEFAULTS = {
  maxTokensPerSend: 500,
  idempotencyTtlSec: 86_400,
  maxDataBytes: 4_000,
} as const;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_SUBJECT_LENGTH = 998;
export const MAX_RECIPIENTS = 50;
