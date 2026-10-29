import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from '../src/middlewares/errorHandler';
import { language } from '../src/middlewares/language';
import { requestId } from '../src/middlewares/requestId';
import { validate, validated } from '../src/middlewares/validate';
import { createLogger } from '../src/utils/logger';
import type { ErrorResponseBody } from '../src/utils/response/errorResponse';

const logger = createLogger({ level: 'silent' });

const schemas = {
  body: z.object({ name: z.string().min(2), age: z.number().int().optional() }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  headers: z.object({ 'x-app-version': z.string().min(1) }),
};

const buildApp = (handler = jest.fn()): { app: express.Express; handler: jest.Mock } => {
  const app = express();
  app.use(requestId(logger));
  app.use(language);
  app.use(express.json());
  app.post('/items/:id', validate(schemas), (req, res) => {
    handler();
    res.json(validated<typeof schemas>(req));
  });
  app.use(errorHandler(logger));
  return { app, handler };
};

const valid = (app: express.Express): request.Test =>
  request(app).post('/items/42?page=3').set('x-app-version', '1.2.3').send({ name: 'Rana' });

describe('validate middleware', () => {
  it('passes parsed, coerced values to the handler', async () => {
    const { app, handler } = buildApp();
    const res = await valid(app);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      body: { name: 'Rana' },
      params: { id: '42' },
      query: { page: 3 },
      headers: { 'x-app-version': '1.2.3' },
    });
  });

  it('applies schema defaults', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/items/1')
      .set('x-app-version', '1')
      .send({ name: 'Rana' });
    expect((res.body as { query: { page: number } }).query.page).toBe(1);
  });

  it('strips unknown keys', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/items/1')
      .set('x-app-version', '1')
      .send({ name: 'Rana', isAdmin: true });
    expect((res.body as { body: object }).body).toEqual({ name: 'Rana' });
  });

  it('rejects with 400 and prefixed field details, without calling the handler', async () => {
    const { app, handler } = buildApp();
    const res = await request(app).post('/items/abc?page=0').send({ name: 'R', age: 1.5 });
    const body = res.body as ErrorResponseBody;
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.map((d) => d.field).sort()).toEqual([
      'body.age',
      'body.name',
      'headers.x-app-version',
      'params.id',
      'query.page',
    ]);
    expect(body.error.details.every((d) => d.message !== '' && d.code !== '')).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('only checks the parts that have a schema', async () => {
    const app = express();
    app.use(requestId(logger));
    app.use(language);
    app.get('/only-query', validate({ query: schemas.query }), (req, res) => {
      res.json(validated<{ query: typeof schemas.query }>(req));
    });
    app.use(errorHandler(logger));
    const res = await request(app).get('/only-query?page=2');
    expect(res.body).toEqual({ query: { page: 2 } });
  });

  it('localizes the error message', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/items/abc').set('Accept-Language', 'en').send({});
    expect((res.body as ErrorResponseBody).message).toBe('The request contains invalid data.');
  });
});
