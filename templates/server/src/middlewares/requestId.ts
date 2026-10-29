import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, REQUEST_ID_MAX_LENGTH, REQUEST_ID_PATTERN } from '../constants/logging';
import type { Logger } from '../utils/logger';

const isUsableRequestId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= REQUEST_ID_MAX_LENGTH &&
  REQUEST_ID_PATTERN.test(value);

/**
 * Assigns `req.id` (reusing a well-formed incoming `X-Request-Id`, otherwise a new UUID),
 * echoes it on the response and binds `req.log` to it.
 */
export const requestId =
  (logger: Logger) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.get(REQUEST_ID_HEADER);
    req.id = isUsableRequestId(incoming) ? incoming : randomUUID();
    req.log = logger.child({ traceId: req.id });
    res.setHeader(REQUEST_ID_HEADER, req.id);
    next();
  };
