export const ENVIRONMENTS = ['dev', 'prod'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Failure codes every `__SYSTEM_SLUG__-*` SDK shares; a kind adds its own under the same prefix. */
export const KERNEL_ERROR_CODES = {
  CONFIG_INVALID: '__SDK_PREFIX___CONFIG_INVALID',
  VALIDATION_FAILED: '__SDK_PREFIX___VALIDATION_FAILED',
  AUTH_FAILED: '__SDK_PREFIX___AUTH_FAILED',
  NETWORK_ERROR: '__SDK_PREFIX___NETWORK_ERROR',
  TIMEOUT: '__SDK_PREFIX___TIMEOUT',
  RATE_LIMITED: '__SDK_PREFIX___RATE_LIMITED',
  UNAVAILABLE: '__SDK_PREFIX___UNAVAILABLE',
  VENDOR_ERROR: '__SDK_PREFIX___VENDOR_ERROR',
  MALFORMED_RESPONSE: '__SDK_PREFIX___MALFORMED_RESPONSE',
  UNKNOWN: '__SDK_PREFIX___UNKNOWN',
} as const;
export type KernelErrorCode = (typeof KERNEL_ERROR_CODES)[keyof typeof KERNEL_ERROR_CODES];
