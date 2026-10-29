import { ZodError } from 'zod';
import { ERROR_CODES } from '../../constants/errorCodes';
import {
  BODY_PARSER_ERROR_TYPES,
  DETAIL_CODE_INVALID,
  JWT_ERROR_NAMES,
  MONGOOSE_CAST_ERROR_NAME,
  MONGOOSE_VALIDATION_ERROR_NAME,
  NETWORK_ERROR_CODES,
  REDIS_UNAVAILABLE_ERROR_MESSAGES,
  REDIS_UNAVAILABLE_ERROR_NAMES,
  TIMEOUT_ERROR_NAMES,
} from '../../constants/errorMapping';
import { errorMessageKey } from '../../constants/errorCodes';
import { HTTP_STATUS } from '../../constants/http';
import { isDuplicateKeyError } from '../database/errors';
import {
  BaseError,
  ConflictError,
  ExternalServiceError,
  InternalError,
  UnauthorizedError,
  ValidationError,
  type ErrorDetail,
} from './index';
import { zodIssuesToDetails } from './zodDetails';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const invalidMessageKey = errorMessageKey(ERROR_CODES.VALIDATION_ERROR);

const mongooseDetails = (errors: unknown): ErrorDetail[] =>
  isRecord(errors)
    ? Object.entries(errors).map(([field, value]) => ({
        field,
        code:
          isRecord(value) && typeof value['kind'] === 'string'
            ? value['kind']
            : DETAIL_CODE_INVALID,
        messageKey: invalidMessageKey,
      }))
    : [];

/**
 * Turns anything that was thrown into a `BaseError` (CLAUDE.md §8).
 * Library errors are recognised by name/shape so this file needs no Mongoose/JWT imports.
 * Anything unrecognised becomes a non-operational `InternalError` that keeps the original as `cause`.
 */
export const normalizeError = (error: unknown): BaseError => {
  if (error instanceof BaseError) return error;
  if (error instanceof ZodError) {
    return new ValidationError({ details: zodIssuesToDetails(error), cause: error });
  }
  if (isRecord(error)) {
    const { name, code, type } = error;
    if (name === MONGOOSE_CAST_ERROR_NAME) return new ValidationError({ cause: error });
    if (name === MONGOOSE_VALIDATION_ERROR_NAME && 'errors' in error) {
      return new ValidationError({ details: mongooseDetails(error['errors']), cause: error });
    }
    if (isDuplicateKeyError(error)) return new ConflictError({ cause: error });
    if (typeof name === 'string' && JWT_ERROR_NAMES.has(name)) {
      return new UnauthorizedError({ cause: error });
    }
    if (type === BODY_PARSER_ERROR_TYPES.parseFailed) return new ValidationError({ cause: error });
    if (type === BODY_PARSER_ERROR_TYPES.tooLarge) {
      return new BaseError({
        code: ERROR_CODES.VALIDATION_ERROR,
        httpStatus: HTTP_STATUS.payloadTooLarge,
        cause: error,
      });
    }
    if (
      (typeof code === 'string' && NETWORK_ERROR_CODES.has(code)) ||
      (typeof name === 'string' &&
        (TIMEOUT_ERROR_NAMES.has(name) || REDIS_UNAVAILABLE_ERROR_NAMES.has(name))) ||
      (error instanceof Error && REDIS_UNAVAILABLE_ERROR_MESSAGES.has(error.message))
    ) {
      return new ExternalServiceError({ unavailable: true, cause: error });
    }
  }
  return new InternalError({ cause: error });
};
