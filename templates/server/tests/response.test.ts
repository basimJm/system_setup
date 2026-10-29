import express, { type Express } from 'express';
import request from 'supertest';
import { SUCCESS_MESSAGE_KEYS } from '../src/constants/messages';
import {
  ADMIN_PAGE_SIZE,
  APP_PAGE_SIZE,
  FIRST_PAGE,
  MAX_PAGE_SIZE,
} from '../src/constants/pagination';
import { errorHandler } from '../src/middlewares/errorHandler';
import { language } from '../src/middlewares/language';
import { requestId } from '../src/middlewares/requestId';
import { validate, validated } from '../src/middlewares/validate';
import { MESSAGES } from '../src/utils/i18n';
import { createLogger } from '../src/utils/logger';
import { buildPaginationMeta, paginationQuery, toSkipLimit } from '../src/utils/pagination';
import type { ErrorResponseBody } from '../src/utils/response/errorResponse';
import {
  sendCreated,
  sendPaginated,
  sendSuccess,
  type SuccessResponseBody,
} from '../src/utils/response/successResponse';

const logger = createLogger({ level: 'silent' });
const ITEMS = [{ id: 'a' }, { id: 'b' }];
const listQuery = { query: paginationQuery(APP_PAGE_SIZE) };

const buildApp = (): Express => {
  const app = express();
  app.use(requestId(logger));
  app.use(language);
  app.get('/ok', (req, res) => {
    sendSuccess(req, res, { data: { hello: 'world' } });
  });
  app.get('/empty', (req, res) => {
    sendSuccess(req, res);
  });
  app.get('/custom', (req, res) => {
    sendSuccess(req, res, { messageKey: 'errors.NOT_FOUND' });
  });
  app.post('/created', (req, res) => {
    sendCreated(req, res, { id: 'new' });
  });
  app.get('/list', validate(listQuery), (req, res) => {
    const { query } = validated<typeof listQuery>(req);
    sendPaginated(req, res, ITEMS, query, 42);
  });
  app.use(errorHandler(logger));
  return app;
};

const bodyOf = (res: request.Response): SuccessResponseBody<unknown> =>
  res.body as SuccessResponseBody<unknown>;

describe('success responses', () => {
  it('wraps data in the base success envelope, localized (Arabic default)', async () => {
    const res = await request(buildApp()).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: MESSAGES.ar[SUCCESS_MESSAGE_KEYS.ok],
      data: { hello: 'world' },
    });
  });

  it('localizes to English and never adds meta to non-paginated responses', async () => {
    const res = await request(buildApp()).get('/ok').set('Accept-Language', 'en');
    expect(bodyOf(res).message).toBe(MESSAGES.en[SUCCESS_MESSAGE_KEYS.ok]);
    expect('meta' in bodyOf(res)).toBe(false);
  });

  it('uses data: null when there is nothing to return', async () => {
    const res = await request(buildApp()).get('/empty');
    expect(bodyOf(res).data).toBeNull();
  });

  it('accepts a custom message key', async () => {
    const res = await request(buildApp()).get('/custom').set('Accept-Language', 'en');
    expect(bodyOf(res).message).toBe(MESSAGES.en['errors.NOT_FOUND']);
  });

  it('answers created resources with 201', async () => {
    const res = await request(buildApp()).post('/created').set('Accept-Language', 'en');
    expect(res.status).toBe(201);
    expect(bodyOf(res)).toMatchObject({
      success: true,
      message: MESSAGES.en[SUCCESS_MESSAGE_KEYS.created],
      data: { id: 'new' },
    });
  });

  it('returns paginated lists with meta { page, pageSize, total }', async () => {
    const res = await request(buildApp()).get('/list?page=2&pageSize=5');
    expect(bodyOf(res).data).toEqual(ITEMS);
    expect(bodyOf(res).meta).toEqual({ page: 2, pageSize: 5, total: 42 });
  });

  it('defaults to page 1 and the configured page size', async () => {
    const res = await request(buildApp()).get('/list');
    expect(bodyOf(res).meta).toEqual({ page: FIRST_PAGE, pageSize: APP_PAGE_SIZE, total: 42 });
  });

  it.each([
    'page=0',
    'page=-1',
    'page=abc',
    'page=1.5',
    `pageSize=${String(MAX_PAGE_SIZE + 1)}`,
    'pageSize=0',
  ])('rejects invalid pagination (%s) with 400', async (query) => {
    const res = await request(buildApp()).get(`/list?${query}`);
    expect(res.status).toBe(400);
    expect((res.body as ErrorResponseBody).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('pagination helpers', () => {
  it('computes skip/limit', () => {
    expect(toSkipLimit({ page: 1, pageSize: 10 })).toEqual({ skip: 0, limit: 10 });
    expect(toSkipLimit({ page: 3, pageSize: 25 })).toEqual({ skip: 50, limit: 25 });
  });

  it('builds meta', () => {
    expect(buildPaginationMeta({ page: 2, pageSize: 10 }, 99)).toEqual({
      page: 2,
      pageSize: 10,
      total: 99,
    });
  });

  it('supports the admin default page size', () => {
    expect(paginationQuery(ADMIN_PAGE_SIZE).parse({})).toEqual({ page: 1, pageSize: 25 });
  });
});
