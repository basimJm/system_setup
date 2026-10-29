import { KERNEL_ERROR_CODES } from '../constants/codes';

export interface SdkErrorOptions {
  readonly retryable?: boolean;
  readonly cause?: unknown;
  /** Never put secrets, credentials or signed URLs here. */
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Every failure of the SDK: a stable `code` the consumer branches on, never a vendor type. */
export class SdkError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: string, message: string, options: SdkErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SdkError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details ?? {};
  }
}

export const isSdkError = (error: unknown): error is SdkError => error instanceof SdkError;

/** The message names fields only, never values. */
export const configError = (message: string, details?: Record<string, unknown>): SdkError =>
  new SdkError(KERNEL_ERROR_CODES.CONFIG_INVALID, message, details ? { details } : {});

export const validationError = (message: string): SdkError =>
  new SdkError(KERNEL_ERROR_CODES.VALIDATION_FAILED, message);

/** Anything thrown that is not ours becomes a typed, non-retryable error (the cause is kept). */
export const toSdkError = (error: unknown, code: string = KERNEL_ERROR_CODES.UNKNOWN): SdkError =>
  isSdkError(error)
    ? error
    : new SdkError(code, error instanceof Error ? error.message : String(error), { cause: error });
