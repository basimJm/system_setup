import { KERNEL_ERROR_CODES } from './codes';

export const ERROR_CODES = {
  ...KERNEL_ERROR_CODES,
  OPERATION_FAILED: '__SDK_PREFIX___OPERATION_FAILED',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** `fake` records requests (dev and tests); `custom` = the consumer injects the adapter of the chosen provider. */
export const PROVIDERS = ['fake', 'custom'] as const;
export type ProviderName = (typeof PROVIDERS)[number];
export const DEV_ONLY_PROVIDERS: readonly ProviderName[] = ['fake'];

export const RESULT_STATUSES = ['DONE', 'QUEUED'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const MAX_OPERATION_LENGTH = 64;
