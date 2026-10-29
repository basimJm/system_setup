import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient } from '@/data/api/ApiClient';
import { buildPath, defineEndpoint, pathParamNames } from '@/data/api/endpoint';
import { newIdempotencyKey } from '@/data/api/idempotency';
import { queryKey } from '@/data/api/queryKeys';
import { OPERATIONS } from '@/data/contract/generated/operations';
import { postAuthLoginBodySchema, postAuthLoginDataSchema } from '@/data/contract/generated/dto';
import type { OperationInfo } from '@/data/contract/operationInfo';
import { AppError } from '@/infrastructure/errors/AppError';
import { fieldErrorsFrom } from '@/infrastructure/errors/fieldErrors';
import { HttpClient, type FetchFn } from '@/infrastructure/http/HttpClient';

const op = (over: Partial<OperationInfo>): OperationInfo => ({
  id: 'testOp',
  method: 'get',
  path: '/admin/v1/things/{id}',
  tag: 'T',
  summary: 's',
  status: 200,
  hasBody: false,
  hasQuery: false,
  hasMeta: false,
  ...over,
});
const ok = (data: unknown, meta?: object) =>
  new Response(JSON.stringify({ success: true, message: 'ok', data, ...(meta ? { meta } : {}) }), {
    status: 200,
  });

function setup(
  respond: (url: string, init: RequestInit) => Response | Promise<Response> = () => ok({ n: 1 }),
) {
  const fetchFn = vi.fn<FetchFn>((url, init) => Promise.resolve(respond(url, init)));
  const http = new HttpClient({
    baseUrl: 'https://api.test',
    fetchFn,
    getToken: () => 'tok',
    getLanguage: () => 'ar',
  });
  return {
    api: new ApiClient(http),
    fetchFn,
    lastUrl: () => new URL(fetchFn.mock.calls.at(-1)![0]),
    lastInit: () => fetchFn.mock.calls.at(-1)![1],
  };
}
const dataN = () => z.object({ n: z.number() });

describe('buildPath / pathParamNames', () => {
  it('fills and encodes placeholders', () => {
    expect(buildPath('/a/{id}/b/{sub}', { id: 'x y', sub: 'a/b' })).toBe('/a/x%20y/b/a%2Fb');
    expect(buildPath('/plain')).toBe('/plain');
    expect(pathParamNames('/a/{id}/b/{sub_1}')).toEqual(['id', 'sub_1']);
    expect(pathParamNames('/plain')).toEqual([]);
  });
  it.each([[{}], [{ id: '' }]])('a missing value (%j) is a programmer error', (params) => {
    expect(() => buildPath('/a/{id}', params)).toThrow(RangeError);
  });
});

describe('defineEndpoint', () => {
  it('accepts schemas that match the contract flags', () => {
    expect(() => defineEndpoint(op({}), { data: dataN })).not.toThrow();
    expect(() =>
      defineEndpoint(op({ hasBody: true }), { data: dataN, body: () => z.object({}) }),
    ).not.toThrow();
  });
  it.each([
    [
      'a body schema for an operation without a body',
      op({}),
      { data: dataN, body: () => z.object({}) },
    ],
    ['no body schema for an operation with a body', op({ hasBody: true }), { data: dataN }],
    [
      'a query schema for an operation without a query',
      op({}),
      { data: dataN, query: () => z.object({}) },
    ],
    ['no query schema for an operation with a query', op({ hasQuery: true }), { data: dataN }],
  ])('refuses %s', (_name, operation, schemas) => {
    expect(() => defineEndpoint(operation, schemas)).toThrow(RangeError);
  });
  it('the real generated login operation lines up with its generated schemas', () => {
    expect(() =>
      defineEndpoint(OPERATIONS.postAuthLogin, {
        data: postAuthLoginDataSchema,
        body: postAuthLoginBodySchema,
      }),
    ).not.toThrow();
  });
});

describe('ApiClient.execute', () => {
  it('calls the right method and path with auth and language, and returns validated data', async () => {
    const { api, lastUrl, lastInit } = setup();
    const ep = defineEndpoint(op({}), { data: dataN });
    const result = await api.execute(ep, { params: { id: 'a b' } });
    expect(result.data).toEqual({ n: 1 });
    expect(lastUrl().pathname).toBe('/admin/v1/things/a%20b');
    expect(lastInit().method).toBe('GET');
    const headers = lastInit().headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok');
    expect(headers['Accept-Language']).toBe('ar');
  });

  it('sends list query values as repeated parameters and drops undefined ones', async () => {
    const { api, lastUrl } = setup();
    const ep = defineEndpoint(op({ path: '/admin/v1/things', hasQuery: true }), {
      data: dataN,
      query: () =>
        z.object({
          status: z.array(z.string()).optional(),
          page: z.number().optional(),
          q: z.string().optional(),
        }),
    });
    await api.execute(ep, { query: { status: ['A', 'B'], page: 2, q: undefined } });
    expect(lastUrl().searchParams.getAll('status')).toEqual(['A', 'B']);
    expect(lastUrl().searchParams.get('page')).toBe('2');
    expect(lastUrl().searchParams.has('q')).toBe(false);
  });

  it('checks the body before sending: nothing is fetched and the fields are named', async () => {
    const { api, fetchFn } = setup();
    const ep = defineEndpoint(OPERATIONS.postAuthLogin, {
      data: postAuthLoginDataSchema,
      body: postAuthLoginBodySchema,
    });
    const failure = await api
      .execute(ep, { body: { email: 'not-an-email', password: '' } })
      .catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    const error = failure as AppError;
    expect(error.kind).toBe('validation');
    expect([...fieldErrorsFrom(error).keys()].sort()).toEqual(['body.email', 'body.password']);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends a valid body as JSON', async () => {
    const { api, lastInit } = setup(() =>
      ok({ otpRequired: true, expiresAt: '2026-10-14T10:00:00Z', resendAfterSeconds: 60 }),
    );
    const ep = defineEndpoint(OPERATIONS.postAuthLogin, {
      data: postAuthLoginDataSchema,
      body: postAuthLoginBodySchema,
    });
    await api.execute(ep, { body: { email: 'a@b.co', password: 'secret' } });
    expect(lastInit().body).toBe(JSON.stringify({ email: 'a@b.co', password: 'secret' }));
  });

  it('an idempotent command gets a fresh key per call; a given key is reused; plain calls get none', async () => {
    const { api, fetchFn } = setup();
    const command = defineEndpoint(
      op({ method: 'post', hasBody: true }),
      { data: dataN, body: () => z.object({}) },
      { idempotent: true },
    );
    const plain = defineEndpoint(op({ method: 'post', hasBody: true }), {
      data: dataN,
      body: () => z.object({}),
    });
    await api.execute(command, { params: { id: '1' }, body: {} });
    await api.execute(command, { params: { id: '1' }, body: {} });
    await api.execute(command, { params: { id: '1' }, body: {}, idempotencyKey: 'fixed-key-123' });
    await api.execute(plain, { params: { id: '1' }, body: {} });
    const keys = fetchFn.mock.calls.map(
      ([, init]) => (init.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[2]).toBe('fixed-key-123');
    expect(keys[3]).toBeUndefined();
  });

  it('passes the caller signal so aborting cancels the request', async () => {
    const { api, lastInit } = setup(() => ok({ n: 1 }));
    const controller = new AbortController();
    await api.execute(defineEndpoint(op({}), { data: dataN }), {
      params: { id: '1' },
      signal: controller.signal,
    });
    controller.abort();
    expect(lastInit().signal?.aborted).toBe(true);
  });

  it('surfaces server errors with the trace id and per-field details', async () => {
    const { api } = setup(
      () =>
        new Response(
          JSON.stringify({
            success: false,
            message: 'bad',
            error: {
              code: 'VALIDATION_ERROR',
              traceId: 'trace-9',
              details: [{ field: 'name.ar', code: 'REQUIRED', message: 'Required' }],
            },
          }),
          { status: 400 },
        ),
    );
    const error = (await api
      .execute(defineEndpoint(op({}), { data: dataN }), { params: { id: '1' } })
      .catch((e: unknown) => e)) as AppError;
    expect(error.traceId).toBe('trace-9');
    expect(fieldErrorsFrom(error).get('name.ar')?.message).toBe('Required');
  });

  it('refuses a response that does not match the contract', async () => {
    const { api } = setup(() => ok({ n: 'one' }));
    const error = (await api
      .execute(defineEndpoint(op({}), { data: dataN }), { params: { id: '1' } })
      .catch((e: unknown) => e)) as AppError;
    expect(error.kind).toBe('parse');
  });
});

describe('ApiClient.executePage', () => {
  const list = defineEndpoint(op({ path: '/admin/v1/things', hasMeta: true }), {
    data: () => z.array(dataN()),
  });
  it('returns the items with the pagination meta', async () => {
    const { api } = setup(() => ok([{ n: 1 }, { n: 2 }], { page: 2, pageSize: 10, total: 12 }));
    const page = await api.executePage(list);
    expect(page.items).toHaveLength(2);
    expect(page.meta).toEqual({ page: 2, pageSize: 10, total: 12 });
  });
  it('a list answer without meta is a contract break', async () => {
    const { api } = setup(() => ok([{ n: 1 }]));
    const error = (await api.executePage(list).catch((e: unknown) => e)) as AppError;
    expect(error.kind).toBe('parse');
    expect(error.code).toBe('MISSING_PAGINATION_META');
  });
});

describe('queryKey / idempotency key', () => {
  const ep = defineEndpoint(op({ hasQuery: true }), {
    data: dataN,
    query: () => z.object({}).loose(),
  });
  it('is stable for the same content in any key order', () => {
    const a = queryKey(ep, { params: { id: '1' }, query: { b: 2, a: 1, z: undefined } });
    const b = queryKey(ep, { params: { id: '1' }, query: { a: 1, b: 2 } });
    expect(a).toEqual(b);
    expect(a[0]).toBe('testOp');
  });
  it('differs when the params or the query differ', () => {
    expect(queryKey(ep, { params: { id: '1' } })).not.toEqual(
      queryKey(ep, { params: { id: '2' } }),
    );
    expect(queryKey(ep, { query: { a: 1 } })).not.toEqual(queryKey(ep, { query: { a: 2 } }));
  });
  it('a whole operation can be invalidated by its id prefix', () => {
    expect(queryKey(ep).slice(0, 1)).toEqual(['testOp']);
  });
  it('idempotency keys are unique uuids', () => {
    const keys = new Set(Array.from({ length: 50 }, newIdempotencyKey));
    expect(keys.size).toBe(50);
  });
});
