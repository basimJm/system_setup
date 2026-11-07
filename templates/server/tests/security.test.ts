import express, { Router, type Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { HEALTH_PATHS } from '../src/constants/health';
import {
  CORS_ALLOWED_HEADERS,
  CORS_MAX_AGE_SEC,
  MAX_SANITIZE_DEPTH,
} from '../src/constants/security';
import { createRateLimiter } from '../src/middlewares/rateLimit';
import { errorHandler } from '../src/middlewares/errorHandler';
import { language } from '../src/middlewares/language';
import { requestId } from '../src/middlewares/requestId';
import { MESSAGES } from '../src/utils/i18n';
import { createLogger } from '../src/utils/logger';
import type { ErrorResponseBody } from '../src/utils/response/errorResponse';
import { sanitizeInput, stripHtml } from '../src/utils/sanitize';

const logger = createLogger({ level: 'silent' });
const ADMIN_ORIGIN = 'https://admin.example.test';

const echoRouter = (): Router => {
  const router = Router();
  router.post('/echo', (req, res) => {
    res.json(req.body);
  });
  router.get('/echo-query', (req, res) => {
    res.json(req.query);
  });
  router.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return router;
};

const buildApp = (extra: Partial<Parameters<typeof createApp>[0]> = {}): Express =>
  createApp({
    logger,
    router: echoRouter(),
    security: { corsAllowedOrigins: [ADMIN_ORIGIN] },
    ...extra,
  });

describe('helmet', () => {
  it('sets hardening headers', async () => {
    const res = await request(buildApp()).get('/ping');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('allows the configured admin origin and exposes the request id', async () => {
    const res = await request(buildApp()).get('/ping').set('Origin', ADMIN_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(res.headers['access-control-expose-headers']).toContain('X-Request-Id');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not grant other origins', async () => {
    const res = await request(buildApp()).get('/ping').set('Origin', 'https://evil.example.test');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('grants no origin when none are configured', async () => {
    const res = await request(createApp({ logger, router: echoRouter() }))
      .get('/ping')
      .set('Origin', ADMIN_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves requests without an Origin header (native apps)', async () => {
    const res = await request(buildApp()).get('/ping');
    expect(res.status).toBe(200);
  });

  it('answers preflight for the admin origin only', async () => {
    const allowed = await request(buildApp())
      .options('/echo')
      .set('Origin', ADMIN_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization,Content-Type');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(allowed.headers['access-control-max-age']).toBe(String(CORS_MAX_AGE_SEC));
    for (const header of CORS_ALLOWED_HEADERS) {
      expect(allowed.headers['access-control-allow-headers']).toContain(header);
    }
    const denied = await request(buildApp())
      .options('/echo')
      .set('Origin', 'https://evil.example.test')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('global rate limit', () => {
  const limited = (trustProxyHops = 0): Express =>
    buildApp({
      security: { corsAllowedOrigins: [], rateLimit: { windowMs: 60_000, max: 2 } },
      trustProxyHops,
    });

  it('answers 429 with the localized RATE_LIMITED envelope after the budget is spent', async () => {
    const app = limited();
    await request(app).get('/ping');
    await request(app).get('/ping');
    const res = await request(app).get('/ping').set('Accept-Language', 'en');
    const body = res.body as ErrorResponseBody;
    expect(res.status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.message).toBe(MESSAGES.en['errors.RATE_LIMITED']);
    expect(res.headers['ratelimit']).toBeDefined();
  });

  it('does not rate limit health and readiness probes', async () => {
    const app = createApp({
      logger,
      security: { rateLimit: { windowMs: 60_000, max: 1 } },
    });
    for (let i = 0; i < 4; i += 1) {
      expect((await request(app).get(HEALTH_PATHS.live)).status).toBe(200);
      expect((await request(app).get(HEALTH_PATHS.ready)).status).toBe(200);
    }
  });

  it('ignores X-Forwarded-For unless proxies are trusted', async () => {
    const app = buildApp({
      security: { corsAllowedOrigins: [], rateLimit: { windowMs: 60_000, max: 1 } },
    });
    await request(app).get('/ping').set('X-Forwarded-For', '192.0.2.1');
    const second = await request(app).get('/ping').set('X-Forwarded-For', '198.51.100.2');
    expect(second.status).toBe(429);
  });

  it('keys clients by the forwarded address when one proxy is trusted', async () => {
    const app = buildApp({
      security: { corsAllowedOrigins: [], rateLimit: { windowMs: 60_000, max: 1 } },
      trustProxyHops: 1,
    });
    const first = await request(app).get('/ping').set('X-Forwarded-For', '192.0.2.1');
    const other = await request(app).get('/ping').set('X-Forwarded-For', '198.51.100.2');
    const repeat = await request(app).get('/ping').set('X-Forwarded-For', '192.0.2.1');
    expect([first.status, other.status, repeat.status]).toEqual([200, 200, 429]);
  });
});

describe('createRateLimiter', () => {
  it('can be applied to a single route with its own budget', async () => {
    const app = express();
    app.use(requestId(logger));
    app.use(language);
    app.get('/otp', createRateLimiter({ windowMs: 60_000, max: 1 }), (_req, res) => {
      res.json({ ok: true });
    });
    app.get('/free', (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler(logger));
    expect((await request(app).get('/otp')).status).toBe(200);
    expect((await request(app).get('/otp')).status).toBe(429);
    expect((await request(app).get('/free')).status).toBe(200);
  });
});

describe('stripHtml', () => {
  it.each([
    ['<script>alert(1)</script>hello', 'hello'],
    ['a <b>bold</b> word', 'a bold word'],
    ['<img src=x onerror=alert(1)>text', 'text'],
    ['<style>body{}</style>ok', 'ok'],
    ['x<!-- hidden -->y', 'xy'],
    ['<scr<script>ipt>alert(1)</scr</script>ipt>', ''],
    ['3 < 5 and 7 > 2', '3 < 5 and 7 > 2'],
    ['plain نص عربي', 'plain نص عربي'],
  ])('strips %p', (input, expected) => {
    expect(stripHtml(input)).toBe(expected);
  });
});

describe('sanitizeInput', () => {
  it('drops operator, dotted and prototype keys at any depth', () => {
    const input = JSON.parse(
      '{"name":"a","$where":"1","a.b":2,"__proto__":{"x":1},"nested":{"$ne":null,"ok":1},"list":[{"$gt":1,"v":2}]}',
    ) as unknown;
    expect(sanitizeInput(input)).toEqual({ name: 'a', nested: { ok: 1 }, list: [{ v: 2 }] });
  });

  it('strips HTML from all string values including arrays', () => {
    expect(sanitizeInput({ bio: '<b>hi</b>', tags: ['<i>a</i>', 'b'] })).toEqual({
      bio: 'hi',
      tags: ['a', 'b'],
    });
  });

  it('leaves secret-like fields untouched but still removes operators inside them', () => {
    expect(sanitizeInput({ password: '<b>p@ss</b>', token: '<x>' })).toEqual({
      password: '<b>p@ss</b>',
      token: '<x>',
    });
    expect(sanitizeInput({ password: { $ne: '' } })).toEqual({ password: {} });
  });

  it('keeps numbers, booleans and null', () => {
    expect(sanitizeInput({ a: 1, b: true, c: null })).toEqual({ a: 1, b: true, c: null });
  });

  it('does not mutate its input', () => {
    const input = { $x: 1, s: '<b>x</b>' };
    sanitizeInput(input);
    expect(input).toEqual({ $x: 1, s: '<b>x</b>' });
  });

  it('rejects absurdly deep input', () => {
    let deep: unknown = 'x';
    for (let i = 0; i <= MAX_SANITIZE_DEPTH + 1; i += 1) deep = { child: deep };
    expect(() => sanitizeInput(deep)).toThrow();
  });
});

describe('sanitizeRequest middleware', () => {
  it('cleans the body before handlers see it', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .send({ name: '<script>x</script>Rana', $where: 'sleep(1000)', 'a.b': 1 });
    expect(res.body).toEqual({ name: 'Rana' });
  });

  it('cleans the query string', async () => {
    const res = await request(buildApp())
      .get('/echo-query')
      .query({ q: '<b>shop</b>', $where: '1' });
    expect(res.body).toEqual({ q: 'shop' });
  });

  it('answers 400 for deeply nested JSON', async () => {
    const nested = `${'{"a":'.repeat(MAX_SANITIZE_DEPTH + 5)}1${'}'.repeat(MAX_SANITIZE_DEPTH + 5)}`;
    const res = await request(buildApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(nested);
    expect(res.status).toBe(400);
    expect((res.body as ErrorResponseBody).error.code).toBe('VALIDATION_ERROR');
  });
});
