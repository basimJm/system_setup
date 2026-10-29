import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HTTP_RETRY } from '@/constants/http';
import type { Language } from '@/constants/i18n';
import { AppError } from '@/infrastructure/errors/AppError';
import { HttpClient, type FetchFn } from '@/infrastructure/http/HttpClient';

const BASE = 'https://api.example.test';
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data: unknown, meta?: unknown) =>
  json(200, { success: true, message: 'ok', data, ...(meta ? { meta } : {}) });
const schema = z.object({ id: z.string() });

function client(
  fetchFn: FetchFn,
  extra: { token?: string | null; language?: Language; onUnauthorized?: () => void } = {},
) {
  return new HttpClient({
    baseUrl: BASE,
    fetchFn,
    getToken: () => extra.token ?? null,
    getLanguage: () => extra.language ?? 'ar',
    sleep: () => Promise.resolve(),
    ...(extra.onUnauthorized ? { onUnauthorized: extra.onUnauthorized } : {}),
  });
}

describe('HttpClient', () => {
  it('sends language, bearer token and query, and returns data + meta', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValue(ok({ id: '1' }, { page: 2, pageSize: 25, total: 60 }));
    const res = await client(fetchFn, { token: 'tkn', language: 'en' }).get('/admin/v1/things', {
      schema,
      query: { page: 2, search: undefined, flag: false },
    });
    expect(res).toEqual({
      data: { id: '1' },
      message: 'ok',
      meta: { page: 2, pageSize: 25, total: 60 },
    });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/admin/v1/things?page=2&flag=false`);
    expect(init.headers).toMatchObject({ 'Accept-Language': 'en', Authorization: 'Bearer tkn' });
  });

  it('omits Authorization without a token and sends JSON bodies', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(ok({ id: '1' }));
    await client(fetchFn).post('/x', { schema, body: { a: 1 } });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"a":1}');
  });

  it('maps the error envelope: kind, code, details, trace id, localized message', async () => {
    const body = {
      success: false,
      message: 'بيانات غير صالحة',
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'body.email', code: 'invalid' }],
        traceId: 'trace-1',
      },
    };
    const err = await client(vi.fn<FetchFn>().mockResolvedValue(json(400, body)))
      .post('/x', { schema })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      kind: 'validation',
      status: 400,
      code: 'VALIDATION_ERROR',
      traceId: 'trace-1',
      serverMessage: 'بيانات غير صالحة',
    });
    expect((err as AppError).details[0]?.field).toBe('body.email');
  });

  it('signs out on 401 and still rejects', async () => {
    const onUnauthorized = vi.fn();
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValue(
        json(401, { success: false, message: 'x', error: { code: 'UNAUTHORIZED' } }),
      );
    await expect(client(fetchFn, { onUnauthorized }).get('/x', { schema })).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('handles non-JSON error bodies by status', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(new Response('<html>', { status: 500 }));
    await expect(client(fetchFn).post('/x', { schema })).rejects.toMatchObject({
      kind: 'server',
      status: 500,
    });
  });

  it('rejects a success response that does not match the schema', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(ok({ id: 5 }));
    await expect(client(fetchFn).get('/x', { schema })).rejects.toMatchObject({ kind: 'parse' });
  });

  it('retries idempotent GETs on 503 and recovers', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(
        json(503, { success: false, message: 'x', error: { code: 'INTERNAL' } }),
      )
      .mockResolvedValueOnce(ok({ id: '1' }));
    await expect(client(fetchFn).get('/x', { schema })).resolves.toMatchObject({
      data: { id: '1' },
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured attempts on network failure', async () => {
    const fetchFn = vi.fn<FetchFn>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(client(fetchFn).get('/x', { schema })).rejects.toMatchObject({ kind: 'network' });
    expect(fetchFn).toHaveBeenCalledTimes(HTTP_RETRY.maxAttempts);
  });

  it('never retries non-idempotent calls', async () => {
    const fetchFn = vi.fn<FetchFn>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(client(fetchFn).post('/x', { schema })).rejects.toMatchObject({ kind: 'network' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry client errors', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValue(json(404, { success: false, message: 'x', error: { code: 'NOT_FOUND' } }));
    await expect(client(fetchFn).get('/x', { schema })).rejects.toMatchObject({ kind: 'notFound' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
