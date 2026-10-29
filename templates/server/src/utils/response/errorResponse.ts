import { ERROR_CODES, errorMessageKey, type ErrorCode } from '../../constants/errorCodes';
import type { BaseError, MessageParams } from '../errors';

export type Translator = (key: string, params?: MessageParams) => string;

export interface ErrorDetailBody {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/** Base error response (CLAUDE.md §6). Clients branch on `error.code`, never on `message`. */
export interface ErrorResponseBody {
  readonly success: false;
  readonly message: string;
  readonly error: {
    readonly code: ErrorCode;
    readonly details: readonly ErrorDetailBody[];
    readonly traceId: string;
  };
}

/**
 * Builds the error body. Non-operational errors are replaced by a generic `INTERNAL` message so
 * messages, details and provider payloads never reach the client.
 */
export const buildErrorBody = (
  error: BaseError,
  translate: Translator,
  traceId: string,
): ErrorResponseBody => {
  if (!error.isOperational) {
    return {
      success: false,
      message: translate(errorMessageKey(ERROR_CODES.INTERNAL)),
      error: { code: ERROR_CODES.INTERNAL, details: [], traceId },
    };
  }
  return {
    success: false,
    message: translate(error.messageKey, error.messageParams),
    error: {
      code: error.code,
      details: error.details.map((detail) => ({
        field: detail.field,
        code: detail.code,
        message: translate(detail.messageKey, detail.params),
      })),
      traceId,
    },
  };
};
