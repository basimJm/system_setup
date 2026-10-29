import express, { type Express } from 'express';
import request from 'supertest';
import { Writable } from 'node:stream';
import { z } from 'zod';
import { ERROR_CODES } from '../src/constants/errorCodes';
import { HTTP_STATUS } from '../src/constants/http';
import { errorHandler } from '../src/middlewares/errorHandler';
import { language } from '../src/middlewares/language';
import { notFound } from '../src/middlewares/notFound';
import { requestId } from '../src/middlewares/requestId';
import { asyncHandler } from '../src/utils/async';
import { ConflictError, ForbiddenError } from '../src/utils/errors';
import { MESSAGES } from '../src/utils/i18n';
import { createLogger } from '../src/utils/logger';
import type { ErrorResponseBody } from '../src/utils/response/errorResponse';

const bodyOf = (res: request.Response): ErrorResponseBody => res.body as ErrorResponseBody;

const SECRET_TEXT = 'db password hunter2 leaked';

const named = (name: string, extra: Record<string, unknown> = {}): Error =>
  Object.assign(new Error(SECRET_TEXT), { name }, extra);

const buildApp = (): { app: Express; logLines: () => Record<string, unknown>[] } => {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb): void {
      chunks.push(chunk.toString());
      cb();
    },
  });
  const logger = createLogger({ level: 'info', destination: stream });
  const app = express();
  app.use(requestId(logger));
  app.use(language);
  app.use(express.json({ limit: '50b' }));

  app.get('/conflict', () => {
    throw new ConflictError({
      code: ERROR_CODES.ITEM_ARCHIVED,
      details: [{ field: 'item', code: 'ARCHIVED', messageKey: 'errors.ITEM_ARCHIVED' }],
    });
  });
  app.get('/forbidden', () => {
    throw new ForbiddenError({ code: ERROR_CODES.PERMISSION_DENIED });
  });
  app.get('/unknown', () => {
    throw new Error(SECRET_TEXT);
  });
  app.get('/thrown-string', () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw SECRET_TEXT;
  });
  app.get(
    '/async',
    asyncHandler(async () => {
      await Promise.resolve();
      throw new ConflictError();
    }),
  );
  app.get('/zod', () => {
    z.object({ phone: z.string().min(5) }).parse({ phone: 'x' });
  });
  app.get('/cast', () => {
    throw named('CastError');
  });
  app.get('/mongoose-validation', () => {
    throw named('ValidationError', { errors: { firstName: { kind: 'required' } } });
  });
  app.get('/duplicate', () => {
    throw Object.assign(new Error(SECRET_TEXT), { code: 11000 });
  });
  app.get('/jwt', () => {
    throw named('TokenExpiredError');
  });
  app.get('/timeout', () => {
    throw Object.assign(new Error(SECRET_TEXT), { code: 'ETIMEDOUT' });
  });
  app.post('/echo', (req, res) => {
    res.json(req.body);
  });
  app.use(notFound);
  app.use(errorHandler(logger));

  const logLines = (): Record<string, unknown>[] =>
    chunks
      .join('')
      .split('\n')
      .filter((l) => l !== '')
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  return { app, logLines };
};

describe('errorHandler (integration)', () => {
  it('answers domain errors with the base error envelope, localized', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/conflict').set('Accept-Language', 'en');
    expect(res.status).toBe(HTTP_STATUS.conflict);
    expect(bodyOf(res)).toEqual({
      success: false,
      message: MESSAGES.en['errors.ITEM_ARCHIVED'],
      error: {
        code: 'ITEM_ARCHIVED',
        details: [
          { field: 'item', code: 'ARCHIVED', message: MESSAGES.en['errors.ITEM_ARCHIVED'] },
        ],
        traceId: res.headers['x-request-id'],
      },
    });
  });

  it('defaults to Arabic', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/forbidden');
    expect(res.status).toBe(HTTP_STATUS.forbidden);
    expect(bodyOf(res).message).toBe(MESSAGES.ar['errors.PERMISSION_DENIED']);
    expect(bodyOf(res).error.code).toBe('PERMISSION_DENIED');
  });

  it.each(['/unknown', '/thrown-string'])(
    'hides internals of unexpected errors (%s)',
    async (path) => {
      const { app, logLines } = buildApp();
      const res = await request(app).get(path).set('Accept-Language', 'en');
      expect(res.status).toBe(HTTP_STATUS.internalServerError);
      expect(bodyOf(res).error.code).toBe('INTERNAL');
      expect(bodyOf(res).message).toBe(MESSAGES.en['errors.INTERNAL']);
      expect(bodyOf(res).error.details).toEqual([]);
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
      expect(JSON.stringify(res.body)).not.toContain('stack');
      const logged = logLines().find((l) => l['msg'] === 'unexpected error');
      expect(logged?.['level']).toBe(50);
      expect(logged?.['traceId']).toBe(res.headers['x-request-id']);
    },
  );

  it('logs operational errors as warnings', async () => {
    const { app, logLines } = buildApp();
    await request(app).get('/conflict');
    const logged = logLines().find((l) => l['msg'] === 'request failed');
    expect(logged).toMatchObject({ level: 40, code: 'ITEM_ARCHIVED', httpStatus: 409 });
  });

  it('routes rejected async handlers to the handler', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/async');
    expect(res.status).toBe(HTTP_STATUS.conflict);
    expect(bodyOf(res).error.code).toBe('CONFLICT');
  });

  it('answers unknown routes with a localized 404', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/nope').set('Accept-Language', 'en');
    expect(res.status).toBe(HTTP_STATUS.notFound);
    expect(bodyOf(res).error.code).toBe('NOT_FOUND');
    expect(bodyOf(res).message).toBe(MESSAGES.en['errors.NOT_FOUND']);
  });

  it('maps schema validation errors to 400 with field details', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/zod');
    expect(res.status).toBe(HTTP_STATUS.badRequest);
    expect(bodyOf(res).error.code).toBe('VALIDATION_ERROR');
    expect(bodyOf(res).error.details).toEqual([
      expect.objectContaining({ field: 'phone', code: 'too_small' }),
    ]);
  });

  it.each([
    ['/cast', HTTP_STATUS.badRequest, 'VALIDATION_ERROR'],
    ['/mongoose-validation', HTTP_STATUS.badRequest, 'VALIDATION_ERROR'],
    ['/duplicate', HTTP_STATUS.conflict, 'CONFLICT'],
    ['/jwt', HTTP_STATUS.unauthorized, 'UNAUTHORIZED'],
    ['/timeout', HTTP_STATUS.serviceUnavailable, 'INTERNAL'],
  ])('maps library error %s to %i %s', async (path, status, code) => {
    const { app } = buildApp();
    const res = await request(app).get(path);
    expect(res.status).toBe(status);
    expect(bodyOf(res).error.code).toBe(code);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('lists mongoose field errors as details', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/mongoose-validation');
    expect(bodyOf(res).error.details).toEqual([
      expect.objectContaining({ field: 'firstName', code: 'required' }),
    ]);
  });

  it('answers malformed JSON with 400 and oversized bodies with 413', async () => {
    const { app } = buildApp();
    const malformed = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(malformed.status).toBe(HTTP_STATUS.badRequest);
    expect(bodyOf(malformed).error.code).toBe('VALIDATION_ERROR');

    const tooLarge = await request(app)
      .post('/echo')
      .send({ text: 'x'.repeat(200) });
    expect(tooLarge.status).toBe(HTTP_STATUS.payloadTooLarge);
    expect(bodyOf(tooLarge).error.code).toBe('VALIDATION_ERROR');
  });
});
