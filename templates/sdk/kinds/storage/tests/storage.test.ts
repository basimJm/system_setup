import { FakeStorage } from '../src/adapters/fake';
import { MemoryStorage } from '../src/adapters/memory';
import { S3Storage } from '../src/adapters/s3';
import { ERROR_CODES, SDK_NAME, createStorage } from '../src';

const cdn = { baseUrl: 'http://localhost:9000/cdn' };
const s3 = {
  region: 'eu-west-1',
  publicBucket: 'pub',
  privateBucket: 'priv',
  credentials: { accessKeyId: 'id', secretAccessKey: 'secret' },
};

describe('createStorage', () => {
  it('picks the adapter from the provider', () => {
    expect(createStorage({ environment: 'dev', provider: 'fake', cdn })).toBeInstanceOf(
      FakeStorage,
    );
    expect(createStorage({ environment: 'dev', provider: 'memory', cdn })).toBeInstanceOf(
      MemoryStorage,
    );
    expect(createStorage({ environment: 'dev', provider: 's3', cdn, s3 })).toBeInstanceOf(
      S3Storage,
    );
    expect(
      createStorage({
        environment: 'dev',
        provider: 's3',
        cdn,
        s3,
        fetch: () => Promise.reject(new Error('x')),
      }),
    ).toBeInstanceOf(S3Storage);
  });

  it('refuses dev-only providers in production and exposes the public surface', () => {
    expect(() =>
      createStorage({
        environment: 'prod',
        provider: 'fake',
        cdn: { baseUrl: 'https://cdn.test' },
      }),
    ).toThrow(expect.objectContaining({ code: ERROR_CODES.CONFIG_INVALID }) as Error);
    expect(SDK_NAME).toBe('__SYSTEM_SLUG__-__SDK_KIND__');
    expect(ERROR_CODES.KEY_INVALID).toBe('__SDK_PREFIX___KEY_INVALID');
  });
});
