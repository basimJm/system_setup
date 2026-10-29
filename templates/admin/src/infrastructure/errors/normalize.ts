import { ZodError } from 'zod';
import { ERROR_CODE_KIND, isErrorCode } from '@/constants/errorCatalog';
import { HTTP_STATUS } from '@/constants/http';
import type { ErrorKind } from '@/constants/errors';
import { AppError } from './AppError';

const KIND_BY_STATUS: Readonly<Record<number, ErrorKind>> = {
  [HTTP_STATUS.badRequest]: 'validation',
  [HTTP_STATUS.unauthorized]: 'unauthorized',
  [HTTP_STATUS.forbidden]: 'forbidden',
  [HTTP_STATUS.notFound]: 'notFound',
  [HTTP_STATUS.conflict]: 'conflict',
  [HTTP_STATUS.unprocessable]: 'conflict',
  [HTTP_STATUS.rateLimited]: 'rateLimited',
  [HTTP_STATUS.gatewayTimeout]: 'timeout',
};

/** Domain error codes win over the HTTP status; unknown 5xx are `server`, other 4xx `unknown`. */
export function kindFromResponse(status: number, code?: string): ErrorKind {
  if (isErrorCode(code)) return ERROR_CODE_KIND[code];
  const byStatus = KIND_BY_STATUS[status];
  if (byStatus) return byStatus;
  return status >= HTTP_STATUS.serverError ? 'server' : 'unknown';
}

const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';
const isTimeout = (e: unknown): boolean => e instanceof DOMException && e.name === 'TimeoutError';

/** Turns anything thrown into an AppError. Never throws, never loses the original as `cause`. */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isTimeout(error)) return new AppError({ kind: 'timeout', cause: error });
  if (isAbort(error)) return new AppError({ kind: 'unknown', cause: error });
  if (error instanceof ZodError) return new AppError({ kind: 'parse', cause: error });
  // `fetch` rejects with a TypeError when the network is unreachable.
  if (error instanceof TypeError) return new AppError({ kind: 'network', cause: error });
  return new AppError({ kind: 'unknown', cause: error });
}
