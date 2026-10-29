import { FakeStorage } from '../src/adapters/fake';
import { MemoryStorage, judgeUpload } from '../src/adapters/memory';
import { resolveConfig, type ResolvedConfig } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/storage';

const START = new Date('2026-01-01T00:00:00Z');
const config = (now: () => Date = () => START): ResolvedConfig =>
  resolveConfig({
    environment: 'dev',
    provider: 'memory',
    cdn: { baseUrl: 'http://localhost:9000/cdn' },
    now,
  });

const request = {
  key: 'u/1/a.png',
  visibility: 'PUBLIC' as const,
  contentType: 'image/png',
  maxBytes: 100,
  expiresInSec: 60,
};

describe('judgeUpload', () => {
  it('orders the rejection reasons', () => {
    expect(judgeUpload(0, 'a/b', 'a/b', 10)).toBe('EMPTY');
    expect(judgeUpload(11, 'a/b', 'a/b', 10)).toBe('TOO_LARGE');
    expect(judgeUpload(5, 'image/PNG', 'image/jpeg', 10)).toBe('TYPE_MISMATCH');
    expect(judgeUpload(5, 'image/PNG', 'image/png', 10)).toBeUndefined();
  });
});

describe('MemoryStorage', () => {
  it('runs the presign → upload → confirm → url → delete lifecycle', async () => {
    const store = new MemoryStorage(config());
    const target = await store.createUploadUrl(request);
    expect(target).toEqual({
      url: 'http://localhost:9000/cdn/__upload/u/1/a.png',
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      expiresAt: new Date(START.getTime() + 60_000),
    });
    expect(store.simulateUpload(request.key, Buffer.from('png-bytes'))).toBe(true);
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'CONFIRMED',
      size: 9,
      contentType: 'image/png',
    });
    expect(store.getPublicUrl(request.key)).toBe('http://localhost:9000/cdn/u/1/a.png');
    await expect(store.read(request.key)).resolves.toEqual(Buffer.from('png-bytes'));
    expect(store.has(request.key)).toBe(true);
    expect(store.size).toBe(1);
    await store.delete([request.key, 'never/there']);
    expect(store.size).toBe(0);
    await expect(store.read(request.key)).resolves.toBeNull();
  });

  it('rejects wrong uploads and deletes them', async () => {
    const store = new MemoryStorage(config());
    await store.createUploadUrl(request);
    store.simulateUpload(request.key, Buffer.from('text'), 'text/plain');
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'REJECTED',
      reason: 'TYPE_MISMATCH',
    });
    expect(store.has(request.key)).toBe(false);
    await store.createUploadUrl(request);
    store.simulateUpload(request.key, Buffer.alloc(0));
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'REJECTED',
      reason: 'EMPTY',
    });
    await store.createUploadUrl(request);
    store.simulateUpload(request.key, Buffer.alloc(101));
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'REJECTED',
      reason: 'TOO_LARGE',
    });
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'REJECTED',
      reason: 'NOT_FOUND',
    });
  });

  it('refuses uploads to an expired or unknown URL and private objects on the public URL', async () => {
    let now = START;
    const store = new MemoryStorage(config(() => now));
    expect(store.simulateUpload(request.key, Buffer.from('x'))).toBe(false);
    await store.createUploadUrl(request);
    now = new Date(START.getTime() + 60_000);
    expect(store.simulateUpload(request.key, Buffer.from('x'))).toBe(false);
    const priv = { ...request, key: 'p/doc.pdf', visibility: 'PRIVATE' as const };
    await store.write({ ...priv, body: Buffer.from('%PDF') });
    expect(() => store.getPublicUrl(priv.key)).toThrow(RangeError);
    await expect(store.confirmUpload(request)).resolves.toEqual({
      status: 'REJECTED',
      reason: 'NOT_FOUND',
    });
    await expect(store.getSignedUrl({ key: priv.key, expiresInSec: 30 })).resolves.toBe(
      `http://localhost:9000/cdn/private/p/doc.pdf?expires=${String(now.getTime() + 30_000)}&signature=memory`,
    );
  });

  it('validates every argument asynchronously', async () => {
    const store = new MemoryStorage(config());
    await expect(store.createUploadUrl({ ...request, key: '' })).rejects.toMatchObject({
      code: ERROR_CODES.KEY_INVALID,
    });
    await expect(store.read('..')).rejects.toMatchObject({ code: ERROR_CODES.KEY_INVALID });
    await expect(store.delete(['ok', '/bad'])).rejects.toMatchObject({
      code: ERROR_CODES.KEY_INVALID,
    });
    await expect(
      store.write({ ...request, body: Buffer.from('x'), contentType: 'bad' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
    expect(() => store.getPublicUrl('')).toThrow(
      expect.objectContaining({ code: ERROR_CODES.KEY_INVALID }) as Error,
    );
  });
});

describe('FakeStorage', () => {
  it('logs calls and injects failures', async () => {
    const fake = new FakeStorage(config());
    await fake.createUploadUrl(request);
    fake.simulateUpload(request.key, Buffer.from('x'));
    await fake.confirmUpload(request);
    fake.getPublicUrl(request.key);
    await fake.getSignedUrl({ key: request.key, expiresInSec: 1 });
    await fake.read(request.key);
    await fake.write({ ...request, body: Buffer.from('y') });
    await fake.delete([request.key]);
    expect(fake.calls).toEqual([
      'createUploadUrl',
      'confirmUpload',
      'getPublicUrl',
      'getSignedUrl',
      'read',
      'write',
      'delete',
    ]);
    fake.failWith = new Error('injected');
    await expect(fake.read(request.key)).rejects.toThrow('injected');
    fake.failWith = undefined;
    await expect(fake.read(request.key)).resolves.toBeNull();
  });
});
