import { ERROR_CODES, errorMessageKey, type ErrorCode } from '../../constants/errorCodes';
import { HTTP_STATUS } from '../../constants/http';

export type MessageParams = Readonly<Record<string, string | number>>;

/** Field-level detail. `messageKey` is localized into `message` when the response is built. */
export interface ErrorDetail {
  readonly field: string;
  readonly code: string;
  readonly messageKey: string;
  readonly params?: MessageParams;
}

export interface BaseErrorOptions {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly messageKey?: string;
  readonly messageParams?: MessageParams;
  readonly details?: readonly ErrorDetail[];
  readonly isOperational?: boolean;
  readonly cause?: unknown;
}

/** Fields callers may set on any typed error. `code` is optional where a class has a default. */
export interface AppErrorOptions {
  readonly code?: ErrorCode;
  readonly messageKey?: string;
  readonly messageParams?: MessageParams;
  readonly details?: readonly ErrorDetail[];
  readonly cause?: unknown;
}

/**
 * Root of every error the server throws on purpose (CLAUDE.md §8).
 * `isOperational` = expected failure (bad input, rule violation); false = programmer/system fault.
 */
export class BaseError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly messageKey: string;
  readonly messageParams: MessageParams | undefined;
  readonly details: readonly ErrorDetail[];
  readonly isOperational: boolean;

  constructor(options: BaseErrorOptions) {
    const messageKey = options.messageKey ?? errorMessageKey(options.code);
    super(messageKey, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.messageKey = messageKey;
    this.messageParams = options.messageParams;
    this.details = options.details ?? [];
    this.isOperational = options.isOperational ?? true;
  }
}

export class ValidationError extends BaseError {
  constructor(options: AppErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.VALIDATION_ERROR,
      httpStatus: HTTP_STATUS.badRequest,
    });
  }
}

export class UnauthorizedError extends BaseError {
  constructor(options: AppErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.UNAUTHORIZED,
      httpStatus: HTTP_STATUS.unauthorized,
    });
  }
}

export class ForbiddenError extends BaseError {
  constructor(options: AppErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.FORBIDDEN,
      httpStatus: HTTP_STATUS.forbidden,
    });
  }
}

export class NotFoundError extends BaseError {
  constructor(options: AppErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.NOT_FOUND,
      httpStatus: HTTP_STATUS.notFound,
    });
  }
}

/** State conflicts such as a taken slot or a concurrent change. */
export class ConflictError extends BaseError {
  constructor(options: AppErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.CONFLICT,
      httpStatus: HTTP_STATUS.conflict,
    });
  }
}

/** Valid request that violates a business rule (e.g. invalid status transition). */
export class BusinessRuleError extends BaseError {
  constructor(options: AppErrorOptions & { readonly code: ErrorCode }) {
    super({ ...options, httpStatus: HTTP_STATUS.unprocessableEntity });
  }
}

export class RateLimitError extends BaseError {
  constructor(options: AppErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.RATE_LIMITED,
      httpStatus: HTTP_STATUS.tooManyRequests,
    });
  }
}

export class PaymentError extends BaseError {
  constructor(options: AppErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.PAYMENT_FAILED,
      httpStatus: HTTP_STATUS.paymentRequired,
    });
  }
}

/**
 * A provider (gateway, Firebase, S3, SMTP...) failed or timed out. The domain defines no dedicated
 * code for this, so it is reported as `INTERNAL` with a 502/503 status.
 */
export class ExternalServiceError extends BaseError {
  constructor(options: AppErrorOptions & { readonly unavailable?: boolean } = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.INTERNAL,
      httpStatus:
        options.unavailable === true ? HTTP_STATUS.serviceUnavailable : HTTP_STATUS.badGateway,
    });
  }
}

/** Unexpected fault. Not operational: the message never reaches the client. */
export class InternalError extends BaseError {
  constructor(options: AppErrorOptions = {}) {
    super({
      ...options,
      code: options.code ?? ERROR_CODES.INTERNAL,
      httpStatus: HTTP_STATUS.internalServerError,
      isOperational: false,
    });
  }
}
