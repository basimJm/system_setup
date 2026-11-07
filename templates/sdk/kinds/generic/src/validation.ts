import { MAX_OPERATION_LENGTH } from './constants/sdk';
import { validationError } from './errors';
import type { __SDK_TITLE__Request } from './types';

/** Throws `VALIDATION_FAILED` (naming the field, never a value) when the request is not acceptable. */
export const assertRequest = (request: __SDK_TITLE__Request): void => {
  const operation = request.operation.trim();
  if (operation === '' || operation.length > MAX_OPERATION_LENGTH)
    throw validationError(`operation: 1 to ${String(MAX_OPERATION_LENGTH)} characters`);
};
