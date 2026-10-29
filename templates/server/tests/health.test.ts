import request from 'supertest';
import { createApp } from '../src/app';
import { HEALTH_PATHS, HEALTH_STATUS } from '../src/constants/health';
import { MESSAGES } from '../src/utils/i18n';
import { TimeoutError, withTimeout } from '../src/utils/async/timeout';
import { createHealthRouter } from '../src/routes/health';
import { runReadinessChecks, type ReadinessCheck } from '../src/utils/health';
import { createLogger } from '../src/utils/logger';
import type { ErrorResponseBody } from '../src/utils/response/errorResponse';
import type { SuccessResponseBody } from '../src/utils/response/successResponse';
import express, { type Express } from 'express';
import { language } from '../src/middlewares/language';
import { requestId } from '../src/middlewares/requestId';
import { errorHandler } from '../src/middlewares/errorHandler';

const logger = createLogger({ level: 'silent' });
const up = (name: string): ReadinessCheck => ({ name, check: () => Promise.resolve() });
const down = (name: string): ReadinessCheck => ({
  name,
  check: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:27017 password=hunter2')),
});
const hang = (name: string): ReadinessCheck => ({
  name,
  check: () => new Promise<void>(() => undefined),
});

const appWith = (checks: readonly ReadinessCheck[]): Express =>
  createApp({ logger, readinessChecks: checks });

describe('GET /health', () => {
  it('is alive without touching dependencies, even when they are down', async () => {
    const res = await request(appWith([down('mongo')])).get(HEALTH_PATHS.live);
    const body = res.body as SuccessResponseBody<{ status: string }>;
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ status: HEALTH_STATUS.ok });
  });

  it('needs no authentication and is localized', async () => {
    const res = await request(appWith([])).get(HEALTH_PATHS.live).set('Accept-Language', 'en');
    expect((res.body as SuccessResponseBody<unknown>).message).toBe(MESSAGES.en['messages.OK']);
  });
});

describe('GET /ready', () => {
  it('is ready with no checks configured', async () => {
    const res = await request(appWith([])).get(HEALTH_PATHS.ready);
    expect(res.status).toBe(200);
    expect((res.body as SuccessResponseBody<unknown>).data).toEqual({
      status: HEALTH_STATUS.ok,
      checks: [],
    });
  });

  it('is ready when every dependency is up', async () => {
    const res = await request(appWith([up('mongo'), up('redis')])).get(HEALTH_PATHS.ready);
    expect(res.status).toBe(200);
    expect((res.body as SuccessResponseBody<unknown>).data).toEqual({
      status: HEALTH_STATUS.ok,
      checks: [
        { name: 'mongo', status: 'up' },
        { name: 'redis', status: 'up' },
      ],
    });
  });

  it('answers 503 and names the dependencies that are down, without leaking errors', async () => {
    const res = await request(appWith([up('redis'), down('mongo')]))
      .get(HEALTH_PATHS.ready)
      .set('Accept-Language', 'en');
    const body = res.body as ErrorResponseBody;
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.details).toEqual([
      { field: 'mongo', code: 'DEPENDENCY_DOWN', message: MESSAGES.en['health.DEPENDENCY_DOWN'] },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('treats a hanging dependency as down', async () => {
    const app = express();
    app.use(requestId(logger));
    app.use(language);
    app.use(createHealthRouter([hang('redis')], 30));
    app.use(errorHandler(logger));
    const res = await request(app).get(HEALTH_PATHS.ready);
    expect(res.status).toBe(503);
    expect((res.body as ErrorResponseBody).error.details[0]?.field).toBe('redis');
  });
});

describe('runReadinessChecks', () => {
  it('runs checks in parallel and keeps the original error for logging', async () => {
    const started: string[] = [];
    const slow = (name: string): ReadinessCheck => ({
      name,
      check: async () => {
        started.push(name);
        await new Promise((resolve) => setTimeout(resolve, 20));
      },
    });
    const results = await runReadinessChecks([slow('a'), slow('b'), down('c')]);
    expect(started).toEqual(['a', 'b']);
    expect(results.map((r) => r.status)).toEqual(['up', 'up', 'down']);
    expect(results[2]?.error).toBeInstanceOf(Error);
  });

  it('never rejects when a check throws synchronously', async () => {
    const throwing: ReadinessCheck = {
      name: 'x',
      check: () => {
        throw new Error('sync failure');
      },
    };
    await expect(runReadinessChecks([throwing])).resolves.toEqual([
      expect.objectContaining({ name: 'x', status: 'down' }),
    ]);
  });
});

describe('withTimeout', () => {
  it('returns the task result', async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it('rejects with TimeoutError when the task is too slow', async () => {
    await expect(withTimeout(new Promise<void>(() => undefined), 10)).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it('passes through the task rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
  });
});
