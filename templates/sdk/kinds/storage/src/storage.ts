import { FakeStorage } from './adapters/fake';
import { MemoryStorage } from './adapters/memory';
import { S3Storage } from './adapters/s3';
import {
  resolveConfig,
  type FetchLike,
  type ResolvedConfig,
  type StorageOptions,
} from './config/options';
import { configError } from './errors';
import type { StorageProvider } from './types';

const buildS3 = (config: ResolvedConfig): S3Storage => {
  /* istanbul ignore next -- resolveConfig already guarantees it; kept for the type checker */
  if (!config.s3) throw configError('s3 options are required', { fields: ['s3'] });
  // Node >= 22 always has a global fetch; `options.fetch` overrides it (tests, proxies).
  const fetchImpl: FetchLike = config.fetch ?? globalThis.fetch;
  return new S3Storage({ ...config, s3: config.s3 }, { fetch: fetchImpl });
};

/** The factory: picks the adapter from `options.provider` (prod refuses fake and memory). */
export const createStorage = (options: StorageOptions): StorageProvider => {
  const config = resolveConfig(options);
  switch (config.provider) {
    case 'fake':
      return new FakeStorage(config);
    case 'memory':
      return new MemoryStorage(config);
    case 's3':
      return buildS3(config);
  }
};
