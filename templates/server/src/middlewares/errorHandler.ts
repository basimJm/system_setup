import type { NextFunction, Request, Response } from 'express';
import { DEFAULT_LANGUAGE } from '../constants/i18n';
import { normalizeError } from '../utils/errors/normalize';
import { translate } from '../utils/i18n';
import type { Logger } from '../utils/logger';
import { buildErrorBody, type Translator } from '../utils/response/errorResponse';

const FALLBACK_TRACE_ID = 'unknown';

/**
 * The one place errors become responses. Mount it last, after `notFound`.
 * Unknown errors are logged with their stack and answered with a generic `INTERNAL` message.
 */
export const errorHandler =
  (fallbackLogger: Logger) =>
  (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const normalized = normalizeError(error);
    // The error may happen before requestId/language ran, so treat those fields as optional.
    const context: Partial<Pick<Request, 'id' | 'log' | 't'>> = req;
    const logger = context.log ?? fallbackLogger;
    const traceId = context.id ?? FALLBACK_TRACE_ID;
    const logFields = { err: error, code: normalized.code, httpStatus: normalized.httpStatus };
    if (normalized.isOperational) {
      logger.warn(logFields, 'request failed');
    } else {
      logger.error(logFields, 'unexpected error');
    }
    const translator: Translator =
      context.t ?? ((key, params) => translate(DEFAULT_LANGUAGE, key, params));
    res.status(normalized.httpStatus).json(buildErrorBody(normalized, translator, traceId));
  };
