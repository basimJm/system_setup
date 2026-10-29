import { Router, type Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { API_PREFIXES, JSON_BODY_LIMIT } from '../src/constants/server';
import { createRootRouter } from '../src/routes';
import { createLogger } from '../src/utils/logger';
import type { ErrorResponseBody } from '../src/utils/response/errorResponse';

const logger = createLogger({ level: 'silent' });

const pingRouter = (name: string): Router => {
  const router = Router();
  router.get('/ping', (req, res) => {
    res.json({ name, language: req.language });
  });
  router.post('/echo', (req, res) => {
    res.json(req.body);
  });
  return router;
};

const testApp = (): Express =>
  createApp({
    logger,
    router: createRootRouter({
      customer: pingRouter('customer'),
      merchant: pingRouter('merchant'),
      admin: pingRouter('admin'),
    }),
  });

describe('createApp', () => {
  it.each(Object.entries(API_PREFIXES))(
    'mounts the %s namespace under %s',
    async (name, prefix) => {
      const res = await request(testApp()).get(`${prefix}/ping`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ name, language: 'ar' });
    },
  );

  it('does not serve namespace routes under another namespace or without a prefix', async () => {
    const app = testApp();
    const wrongPrefix = await request(app).get('/ping');
    const unversioned = await request(app).get('/customer/ping');
    expect(wrongPrefix.status).toBe(404);
    expect(unversioned.status).toBe(404);
  });

  it('answers unknown routes with the localized 404 envelope and a request id', async () => {
    const res = await request(testApp()).get('/nope').set('Accept-Language', 'en');
    const body = res.body as ErrorResponseBody;
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.traceId).toBe(res.headers['x-request-id']);
  });

  it('runs the language middleware before routes', async () => {
    const res = await request(testApp())
      .get(`${API_PREFIXES.customer}/ping`)
      .set('Accept-Language', 'en-US');
    expect((res.body as { language: string }).language).toBe('en');
  });

  it('hides the X-Powered-By header', async () => {
    const res = await request(testApp()).get(`${API_PREFIXES.admin}/ping`);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('parses JSON bodies', async () => {
    const res = await request(testApp()).post(`${API_PREFIXES.admin}/echo`).send({ a: 1 });
    expect(res.body).toEqual({ a: 1 });
  });

  it('answers malformed JSON with 400 VALIDATION_ERROR', async () => {
    const res = await request(testApp())
      .post(`${API_PREFIXES.admin}/echo`)
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect((res.body as ErrorResponseBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('answers bodies over the limit with 413', async () => {
    const oversized = { text: 'x'.repeat(Number.parseInt(JSON_BODY_LIMIT, 10) * 1024 + 1) };
    const res = await request(testApp()).post(`${API_PREFIXES.admin}/echo`).send(oversized);
    expect(res.status).toBe(413);
  });

  it('serves the real, still empty, namespaces without crashing', async () => {
    const res = await request(createApp({ logger })).get(`${API_PREFIXES.customer}/anything`);
    expect(res.status).toBe(404);
  });
});
