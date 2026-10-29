import type { NextFunction, Request, Response } from 'express';
import { sanitizeInput } from '../utils/sanitize';

/**
 * Sanitizes body and query before any controller sees them. Express 5 exposes `req.query` as a
 * read-only getter, so the sanitized copy is defined on the request object itself.
 * Route params are checked by the `validate` middleware schemas instead.
 */
export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (req.body !== undefined) req.body = sanitizeInput(req.body);
    Object.defineProperty(req, 'query', {
      value: sanitizeInput(req.query),
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  } catch (error) {
    next(error);
  }
};
