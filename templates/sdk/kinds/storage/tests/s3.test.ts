import { S3Storage, mapStatus } from '../src/adapters/s3';
import { resolveConfig, type StorageOptions } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/storage';
import type { Logger } from '../src/logger';
import { MiniS3 } from './helpers/miniS3';

const START = new Date('2026-01-01T00:00:00Z');
const instant = { sleep: () => Promise.resolve(), random: () => 0.5 };
const s3Options = {
  region: 'eu-west-1',
  publicBucket: 'pub',
  privateBucket: 'priv',
  credentials: { accessKeyId: 'id', secretAccessKey: 'secret' },
};

const build = (
  overrides: Partial<StorageOptions> = {},
  logger?: Logger,
): { store: S3Storage; wire: MiniS3 } => {
  const wire = new MiniS3();
  const options: StorageOptions = {
    environment: 'dev',
    provider: 's3',
    cdn: { baseUrl: 'http://localhost:9000/cdn' },
    s3: { ...s3Options, endpoint: 'http://localhost:9000' },
    retry: { maxAttempts: 2 },
    readMaxBytes: 100,
    timeoutMs: 50,
    now: () => START,
    fetch: wire.fetch,
    ...overrides,
    ...(logger ? { logger } : {}),
  };
  const config = resolveConfig(options);
  /* resolveConfig guarantees s3 for provider s3 */
  const store = new S3Storage(
    { ...config, s3: config.s3 ?? { ...s3Options, forcePathStyle: true } },
    { fetch: config.fetch ?? wire.fetch, retryDeps: instant },
  );
  return { store, wire };
};

const request = {
  key: 'u/1/a.png',
  visibility: 'PUBLIC' as const,
  contentType: 'image/png',
  maxBytes: 100,
  expiresInSec: 60,
};

describe('mapStatus', () => {
  it('maps every status the store can answer', () => {
    expect(mapStatus(200)).toBe('ok');
    expect(mapStatus(204)).toBe('ok');
    expect(mapStatus(404)).toBe('notFound');
    const codes = [403, 429, 503, 500, 400, 418].map((status) => {
      const mapped = mapStatus(status);
      return typeof mapped === 'string' ? mapped : [mapped.code, mapped.retryable];
    });
    expect(codes).toEqual([
      [ERROR_CODES.AUTH_FAILED, false],
      [ERROR_CODES.RATE_LIMITED, true],
      [ERROR_CODES.RATE_LIMITED, true],
      [ERROR_CODES.UNAVAILABLE, true],
      [ERROR_CODES.VENDOR_ERROR, false],
      [ERROR_CODES.UNKNOWN, false],
    ]);
  });
});

describe('S3Storage urls', () => {
  it('builds path-style, virtual-host and AWS object URLs', () => {
    expect(build().store.objectUrl('PUBLIC', 'a b/c').toString()).toBe(
      'http://localhost:9000/pub/a%20b/c',
    );
    const virtual = build({
      s3: { ...s3Options, endpoint: 'https://r2.example.test/', forcePathStyle: false },
    });
    expect(virtual.store.objectUrl('PRIVATE', 'k').toString()).toBe(
      'https://priv.r2.example.test/k',
    );
    const aws = build({ s3: s3Options });
    expect(aws.store.objectUrl('PRIVATE', 'k').toString()).toBe(
      'https://priv.s3.eu-west-1.amazonaws.com/k',
    );
    expect(aws.store.getPublicUrl('a/b.c')).toBe('http://localhost:9000/cdn/a/b.c');
  });

  it('presigns uploads and private reads without touching the network', async () => {
    const { store, wire } = build();
    const target = await store.createUploadUrl(request);
    expect(target.method).toBe('PUT');
    expect(target.headers).toEqual({ 'Content-Type': 'image/png' });
    expect(target.expiresAt).toEqual(new Date(START.getTime() + 60_000));
    expect(target.url).toMatch(
      /^http:\/\/localhost:9000\/pub\/u\/1\/a\.png\?X-Amz-Algorithm=AWS4-HMAC-SHA256&.*X-Amz-Signature=[0-9a-f]{64}$/,
    );
    const signed = await store.getSignedUrl({ key: 'p/doc.pdf', expiresInSec: 30 });
    expect(signed).toContain('http://localhost:9000/priv/p/doc.pdf?');
    expect(signed).toContain('X-Amz-Expires=30');
    expect(wire.requests).toHaveLength(0);
    await expect(store.createUploadUrl({ ...request, expiresInSec: 0 })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  });
});

describe('S3Storage confirm / read / write / delete', () => {
  it('confirms a good upload and reports a missing one', async () => {
    const { store, wire } = build();
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'REJECTED',
      reason: 'NOT_FOUND',
    });
    const target = await store.createUploadUrl(request);
    wire.put(target.url, Buffer.from('12345'), 'image/png');
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'CONFIRMED',
      size: 5,
      contentType: 'image/png',
    });
    expect(wire.requests.map((r) => r.method)).toEqual(['HEAD', 'HEAD']);
  });

  it('deletes rejected uploads and refuses a HEAD without content-length', async () => {
    const { store, wire } = build();
    const target = await store.createUploadUrl(request);
    wire.put(target.url, Buffer.from('text'), 'text/plain');
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'REJECTED',
      reason: 'TYPE_MISMATCH',
    });
    expect(wire.size).toBe(0);
    expect(wire.requests.map((r) => r.method)).toEqual(['HEAD', 'DELETE']);
    wire.nextStatus.push(200);
    await expect(store.confirmUpload(request)).rejects.toMatchObject({
      code: ERROR_CODES.MALFORMED_RESPONSE,
    });
  });

  it('writes, reads public then private, and refuses oversized objects', async () => {
    const { store, wire } = build();
    const priv = {
      key: 'p/doc.pdf',
      visibility: 'PRIVATE' as const,
      contentType: 'application/pdf',
    };
    await store.write({ ...priv, body: Buffer.from('%PDF') });
    await expect(store.read(priv.key)).resolves.toEqual(Buffer.from('%PDF'));
    expect(wire.requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      'PUT /priv/p/doc.pdf',
      'GET /pub/p/doc.pdf',
      'GET /priv/p/doc.pdf',
    ]);
    await expect(store.read('none/here')).resolves.toBeNull();
    await store.write({ ...request, body: Buffer.alloc(101) });
    await expect(store.read(request.key)).rejects.toMatchObject({
      code: ERROR_CODES.TOO_LARGE,
      details: { size: 101 },
    });
    await expect(store.read('')).rejects.toMatchObject({ code: ERROR_CODES.KEY_INVALID });
  });

  it('deletes both locations in bounded batches and ignores missing keys', async () => {
    const { store, wire } = build();
    await store.write({ ...request, body: Buffer.from('x') });
    const keys = Array.from({ length: 11 }, (_, i) => `k/${String(i)}`).concat(request.key);
    await store.delete(keys);
    expect(wire.size).toBe(0);
    expect(wire.requests).toHaveLength(1 + keys.length * 2);
    expect(wire.requests.every((r, i) => i === 0 || r.method === 'DELETE')).toBe(true);
  });
});

describe('S3Storage failures', () => {
  it('maps statuses, logs them without secrets and retries retryable ones', async () => {
    const warnings: unknown[] = [];
    const logger: Logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: (message, fields) => {
        warnings.push([message, fields]);
      },
      error: () => undefined,
    };
    const { store, wire } = build({}, logger);
    wire.nextStatus.push(503);
    await expect(store.read('k')).resolves.toBeNull();
    expect(warnings).toEqual([['store request failed', { method: 'GET', status: 503 }]]);
    wire.nextStatus.push(403);
    await expect(store.read('k')).rejects.toMatchObject({ code: ERROR_CODES.AUTH_FAILED });
    wire.nextStatus.push(500, 500);
    await expect(store.read('k')).rejects.toMatchObject({
      code: ERROR_CODES.UNAVAILABLE,
      retryable: true,
    });
  });

  it('wraps network errors and timeouts as retryable SDK errors', async () => {
    const { store, wire } = build();
    wire.failNext.push(new Error('ECONNREFUSED'), new Error('ECONNREFUSED'));
    await expect(store.read('k')).rejects.toMatchObject({
      code: ERROR_CODES.NETWORK_ERROR,
      retryable: true,
    });
    const slow = build({
      fetch: () => new Promise(() => undefined),
      retry: { maxAttempts: 1 },
    });
    await expect(slow.store.read('k')).rejects.toMatchObject({
      code: ERROR_CODES.TIMEOUT,
      retryable: true,
    });
  });

  it('answers 403 when a request is not signed (emulator sanity)', async () => {
    const wire = new MiniS3();
    const response = await wire.fetch('http://localhost:9000/pub/k', {
      method: 'GET',
      headers: {},
    });
    expect(response.status).toBe(403);
    const odd = await wire.fetch('http://localhost:9000/pub/k', {
      method: 'PATCH',
      headers: { Authorization: 'x' },
    });
    expect(odd.status).toBe(400);
    expect(odd.headers.get('nothing')).toBeNull();
    expect(Buffer.from(await odd.arrayBuffer())).toHaveLength(0);
  });
});
