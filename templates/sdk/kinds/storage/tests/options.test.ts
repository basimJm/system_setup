import { resolveConfig, type StorageOptions } from '../src/config/options';
import { ERROR_CODES } from '../src/constants/storage';
import { noopLogger } from '../src/logger';

const s3 = {
  region: 'eu-west-1',
  publicBucket: 'pub',
  privateBucket: 'priv',
  credentials: { accessKeyId: 'id', secretAccessKey: 'secret' },
};
const dev: StorageOptions = {
  environment: 'dev',
  provider: 'memory',
  cdn: { baseUrl: 'http://localhost:9000/cdn/' },
};

const fieldsOf = (options: StorageOptions): string[] => {
  try {
    resolveConfig(options);
  } catch (error) {
    const details = (error as { code: string; details: { fields: string[] } }).details;
    expect((error as { code: string }).code).toBe(ERROR_CODES.CONFIG_INVALID);
    return details.fields;
  }
  return [];
};

describe('resolveConfig', () => {
  it('applies defaults, trims the CDN base and wraps the logger', () => {
    const config = resolveConfig(dev);
    expect(config).toMatchObject({
      environment: 'dev',
      provider: 'memory',
      cdnBaseUrl: 'http://localhost:9000/cdn',
      uploadMaxTtlSec: 300,
      signedUrlMaxTtlSec: 600,
      readMaxBytes: 50 * 1024 * 1024,
      timeoutMs: 10_000,
      retry: { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 5_000, jitterRatio: 0.2 },
      fetch: undefined,
    });
    expect(config.s3).toBeUndefined();
    expect(config.now()).toBeInstanceOf(Date);
    expect(() => {
      config.logger.info('x', { secret: 's' });
    }).not.toThrow();
  });

  it('keeps injected objects out of validation and infers forcePathStyle', () => {
    const now = (): Date => new Date(0);
    const fetch = jest.fn();
    const config = resolveConfig({
      ...dev,
      provider: 's3',
      s3: { ...s3, endpoint: 'http://localhost:9000' },
      logger: noopLogger,
      fetch,
      now,
      upload: { maxTtlSec: 60 },
      signedUrl: { maxTtlSec: 120 },
      readMaxBytes: 10,
      timeoutMs: 5,
      retry: { maxAttempts: 1 },
    });
    expect(config.s3?.forcePathStyle).toBe(true);
    expect(config.now).toBe(now);
    expect(config.fetch).toBe(fetch);
    expect(config).toMatchObject({
      uploadMaxTtlSec: 60,
      signedUrlMaxTtlSec: 120,
      readMaxBytes: 10,
      timeoutMs: 5,
      retry: { maxAttempts: 1, baseDelayMs: 200 },
    });
    expect(resolveConfig({ ...dev, provider: 's3', s3 }).s3?.forcePathStyle).toBe(false);
    expect(
      resolveConfig({
        ...dev,
        provider: 's3',
        s3: { ...s3, endpoint: 'http://localhost:9000', forcePathStyle: false },
      }).s3?.forcePathStyle,
    ).toBe(false);
  });

  it('names invalid fields, never values', () => {
    expect(fieldsOf({ ...dev, cdn: { baseUrl: 'nope' } })).toEqual(['cdn.baseUrl']);
    expect(fieldsOf({ ...dev, provider: 'ftp' as 'fake' })).toEqual(['provider']);
    expect(fieldsOf({ ...dev, upload: { maxTtlSec: 999_999_999 } })).toEqual(['upload.maxTtlSec']);
    expect(fieldsOf({ ...dev, extra: 1 } as StorageOptions)).toEqual(['']);
  });

  it('requires s3 options for the s3 provider', () => {
    expect(fieldsOf({ ...dev, provider: 's3' })).toEqual(['s3']);
  });

  it('is strict in production', () => {
    const prod: StorageOptions = {
      environment: 'prod',
      provider: 's3',
      s3,
      cdn: { baseUrl: 'https://cdn.example.test' },
    };
    expect(fieldsOf(prod)).toEqual([]);
    expect(fieldsOf({ ...prod, provider: 'fake' })).toEqual(['provider']);
    expect(fieldsOf({ ...prod, provider: 'memory' })).toEqual(['provider']);
    expect(fieldsOf({ ...prod, cdn: { baseUrl: 'http://cdn.example.test' } })).toEqual([
      'cdn.baseUrl',
    ]);
    expect(fieldsOf({ ...prod, s3: { ...s3, endpoint: 'http://minio.internal' } })).toEqual([
      's3.endpoint',
    ]);
    expect(fieldsOf({ ...prod, s3: { ...s3, privateBucket: 'pub' } })).toEqual([
      's3.privateBucket',
    ]);
    expect(fieldsOf({ ...dev, provider: 's3', s3: { ...s3, privateBucket: 'pub' } })).toEqual([]);
  });
});
