import type { ZodError } from 'zod';
import { ERROR_CODES, errorMessageKey } from '../../constants/errorCodes';
import { FIELD_PATH_SEPARATOR } from '../../constants/server';
import type { ErrorDetail } from './index';

const invalidMessageKey = errorMessageKey(ERROR_CODES.VALIDATION_ERROR);

/** Field-level details for a zod failure; `prefix` names the request part (e.g. `body`). */
export const zodIssuesToDetails = (error: ZodError, prefix?: string): ErrorDetail[] =>
  error.issues.map((issue) => ({
    field: [...(prefix === undefined ? [] : [prefix]), ...issue.path.map(String)].join(
      FIELD_PATH_SEPARATOR,
    ),
    code: issue.code,
    messageKey: invalidMessageKey,
  }));
