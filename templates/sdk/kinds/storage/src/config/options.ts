import { z } from 'zod';
import type { Environment } from '../constants/codes';
import { DEFAULT_TIMEOUT_MS } from '../constants/defaults';
import {
  DEFAULT_READ_MAX_BYTES,
  DEFAULT_SIGNED_URL_MAX_TTL_SEC,
  DEFAULT_UPLOAD_MAX_TTL_SEC,
  DEV_ONLY_PROVIDERS,
  MAX_PRESIGN_TTL_SEC,
  PROVIDERS,
  type ProviderName,
} from '../constants/storage';
import { noopLogger, redactingLogger, type Logger } from '../logger';
import type { RetryPolicy } from '../retry';
import {
  environmentSchema,
  parseOptions,
  plainOptions,
  positiveInt,
  prodIssues,
  resolveRetry,
  retrySchema,
  text,
  throwIfIssues,
  trimSlash,
  type ConfigIssue,
} from './common';

const credentialsSchema = z
  .object({ accessKeyId: text, secretAccessKey: text, sessionToken: text.optional() })
  .strict();

const s3Schema = z
  .object({
    region: text,
    publicBucket: text,
    privateBucket: text,
    /** S3-compatible endpoint (MinIO, Spaces, R2); unset for AWS itself. */
    endpoint: z.url().optional(),
    forcePathStyle: z.boolean().optional(),
    credentials: credentialsSchema,
  })
  .strict();

const ttlSchema = z
  .object({ maxTtlSec: positiveInt.max(MAX_PRESIGN_TTL_SEC) })
  .partial()
  .strict();

const optionsSchema = z
  .object({
    environment: environmentSchema,
    provider: z.enum(PROVIDERS),
    s3: s3Schema.optional(),
    /** Base URL public objects are served from (CDN domain). */
    cdn: z.object({ baseUrl: z.url() }).strict(),
    upload: ttlSchema.optional(),
    signedUrl: ttlSchema.optional(),
    readMaxBytes: positiveInt.optional(),
    timeoutMs: positiveInt.optional(),
    retry: retrySchema.optional(),
  })
  .strict();

/** Minimal `fetch` the S3 adapter needs; defaults to the global one. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: Uint8Array },
) => Promise<{
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface StorageOptions extends z.input<typeof optionsSchema> {
  readonly logger?: Logger;
  readonly fetch?: FetchLike;
  readonly now?: () => Date;
}

export type S3Config = z.infer<typeof s3Schema> & { readonly forcePathStyle: boolean };

export interface ResolvedConfig {
  readonly environment: Environment;
  readonly provider: ProviderName;
  readonly s3?: S3Config | undefined;
  readonly cdnBaseUrl: string;
  readonly uploadMaxTtlSec: number;
  readonly signedUrlMaxTtlSec: number;
  readonly readMaxBytes: number;
  readonly timeoutMs: number;
  readonly retry: RetryPolicy;
  readonly logger: Logger;
  readonly fetch: FetchLike | undefined;
  readonly now: () => Date;
}

const INJECTED = ['logger', 'fetch', 'now'];

const crossFieldIssues = (o: z.infer<typeof optionsSchema>): ConfigIssue[] => {
  const issues: ConfigIssue[] = [];
  if (o.provider === 's3' && !o.s3)
    issues.push({ path: 's3', message: 'required for provider s3' });
  if (o.s3 && o.s3.publicBucket === o.s3.privateBucket && o.environment === 'prod')
    issues.push({ path: 's3.privateBucket', message: 'must differ from publicBucket in prod' });
  return issues.concat(
    prodIssues({
      environment: o.environment,
      provider: o.provider,
      devOnlyProviders: DEV_ONLY_PROVIDERS,
      urls: [
        { path: 'cdn.baseUrl', url: o.cdn.baseUrl },
        { path: 's3.endpoint', url: o.s3?.endpoint },
      ],
    }),
  );
};

/** Validates the options once; the error names fields only, never values. */
export const resolveConfig = (options: StorageOptions): ResolvedConfig => {
  const o = parseOptions(optionsSchema, plainOptions(options, INJECTED), 'storage');
  throwIfIssues(crossFieldIssues(o), 'storage');
  return {
    environment: o.environment,
    provider: o.provider,
    s3: o.s3 && { ...o.s3, forcePathStyle: o.s3.forcePathStyle ?? o.s3.endpoint !== undefined },
    cdnBaseUrl: trimSlash(o.cdn.baseUrl),
    uploadMaxTtlSec: o.upload?.maxTtlSec ?? DEFAULT_UPLOAD_MAX_TTL_SEC,
    signedUrlMaxTtlSec: o.signedUrl?.maxTtlSec ?? DEFAULT_SIGNED_URL_MAX_TTL_SEC,
    readMaxBytes: o.readMaxBytes ?? DEFAULT_READ_MAX_BYTES,
    timeoutMs: o.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retry: resolveRetry(o.retry),
    logger: redactingLogger(options.logger ?? noopLogger),
    fetch: options.fetch,
    now: options.now ?? (() => new Date()),
  };
};
