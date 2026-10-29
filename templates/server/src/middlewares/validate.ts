import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType, infer as Infer } from 'zod';
import { VALIDATION_PARTS, type ValidationPart } from '../constants/server';
import { ValidationError, type ErrorDetail } from '../utils/errors';
import { zodIssuesToDetails } from '../utils/errors/zodDetails';

export type RequestSchemas = Partial<Record<ValidationPart, ZodType>>;

/** Parsed (coerced, unknown keys stripped) values for exactly the parts that have a schema. */
export type Validated<S extends RequestSchemas> = {
  [K in keyof S & ValidationPart]: S[K] extends ZodType ? Infer<S[K]> : never;
};

/**
 * Validates body, params, query and headers against zod schemas. Every failing part is reported
 * together as field details (`body.phone`, `query.page`...). Header schemas must use lower-case keys.
 * Controllers read the typed result with `validated<typeof schemas>(req)`.
 */
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const parsed: Record<string, unknown> = {};
    const details: ErrorDetail[] = [];
    for (const part of VALIDATION_PARTS) {
      const schema = schemas[part];
      if (schema === undefined) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) parsed[part] = result.data;
      else details.push(...zodIssuesToDetails(result.error, part));
    }
    if (details.length > 0) {
      next(new ValidationError({ details }));
      return;
    }
    req.validated = parsed;
    next();
  };

/** Typed access to what `validate(schemas)` stored on the request. */
export const validated = <S extends RequestSchemas>(req: Request): Validated<S> =>
  req.validated as Validated<S>;
