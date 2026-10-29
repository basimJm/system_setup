import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async handler so a rejected promise always reaches the global error handler. */
export const asyncHandler =
  (handler: AsyncHandler): RequestHandler =>
  (req, res, next): void => {
    handler(req, res, next).catch(next);
  };
