import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../src/constants/errorCodes';
import { errorHandler } from '../src/middlewares/errorHandler';
import { ConflictError, InternalError, ValidationError } from '../src/utils/errors';
import { normalizeError } from '../src/utils/errors/normalize';
import { createLogger } from '../src/utils/logger';
import { buildErrorBody, type ErrorResponseBody } from '../src/utils/response/errorResponse';

describe('normalizeError', () => {
  it('returns BaseError instances untouched', () => {
    const error = new ConflictError({ code: ERROR_CODES.ITEM_ARCHIVED });
    expect(normalizeError(error)).toBe(error);
  });

  it.each([[undefined], [null], [42], ['text'], [{}], [[]]])(
    'turns %p into a non-operational InternalError',
    (thrown) => {
      const result = normalizeError(thrown);
      expect(result).toBeInstanceOf(InternalError);
      expect(result.isOperational).toBe(false);
      expect(result.cause).toBe(thrown);
    },
  );

  it('keeps the original error as cause', () => {
    const original = new Error('boom');
    expect(normalizeError(original).cause).toBe(original);
  });

  it('ignores a ValidationError-named object without Mongoose `errors`', () => {
    const lookalike = Object.assign(new Error('x'), { name: 'ValidationError' });
    expect(normalizeError(lookalike)).toBeInstanceOf(InternalError);
  });
});

describe('buildErrorBody', () => {
  const translate = (key: string): string => `t(${key})`;

  it('localizes message and details', () => {
    const body = buildErrorBody(
      new ValidationError({
        details: [{ field: 'a', code: 'X', messageKey: 'errors.VALIDATION_ERROR' }],
      }),
      translate,
      'trace-1',
    );
    expect(body.message).toBe('t(errors.VALIDATION_ERROR)');
    expect(body.error).toEqual({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'a', code: 'X', message: 't(errors.VALIDATION_ERROR)' }],
      traceId: 'trace-1',
    });
  });

  it('replaces non-operational errors with a generic INTERNAL body', () => {
    const body = buildErrorBody(
      new InternalError({
        messageKey: 'secret.key',
        details: [{ field: 'f', code: 'c', messageKey: 'k' }],
      }),
      translate,
      'trace-2',
    );
    expect(body.message).toBe('t(errors.INTERNAL)');
    expect(body.error.details).toEqual([]);
    expect(body.error.code).toBe('INTERNAL');
  });
});

describe('errorHandler edge cases', () => {
  const logger = createLogger({ level: 'silent' });

  it('delegates to Express when the response already started', () => {
    const next = jest.fn();
    const res = { headersSent: true } as unknown as Response;
    const error = new Error('late');
    errorHandler(logger)(error, {} as Request, res, next as NextFunction);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('still answers when requestId/language middleware never ran', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { headersSent: false, status } as unknown as Response;
    errorHandler(logger)(new Error('early'), {} as Request, res, jest.fn() as NextFunction);
    expect(status).toHaveBeenCalledWith(500);
    const [body] = json.mock.calls[0] as [ErrorResponseBody];
    expect(body.success).toBe(false);
    expect(body.error).toMatchObject({ code: 'INTERNAL', traceId: 'unknown' });
  });
});
