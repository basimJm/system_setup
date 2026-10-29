import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../utils/errors';

/** Mounted after all routes: any unmatched request becomes a localized 404. */
export const notFound = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError());
};
