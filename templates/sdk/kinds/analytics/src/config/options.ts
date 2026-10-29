import { z } from 'zod';
import type { Environment } from '../constants/codes';
import { DEFAULT_TIMEOUT_MS } from '../constants/defaults';
import {
  DEFAULTS,
  DEV_ONLY_PROVIDERS,
  MAX_BATCH_SIZE,
  PROVIDERS,
  type ProviderName,
} from '../constants/analytics';
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
import type { AnalyticsSink } from '../types';

const httpSchema = z.object({ endpoint: z.url(), apiKey: text.optional() }).strict();

const optionsSchema = z
  .object({
    environment: environmentSchema,
    provider: z.enum(PROVIDERS),
    http: httpSchema.optional(),
    batchSize: positiveInt.max(MAX_BATCH_SIZE).optional(),
    /** 0 disables the timer: only `batchSize` and `flush()` deliver. */
    flushIntervalMs: z.number().int().nonnegative().optional(),
    maxQueue: positiveInt.optional(),
    timeoutMs: positiveInt.optional(),
    retry: retrySchema.optional(),
  })
  .strict();

/** Minimal `fetch` the http sink needs; defaults to the global one. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ readonly status: number }>;

export interface TimerLike {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface AnalyticsOptions extends z.input<typeof optionsSchema> {
  /** A custom sink used instead of the provider's (any provider name; prod refuses `isFake`). */
  readonly sink?: AnalyticsSink;
  readonly logger?: Logger;
  readonly fetch?: FetchLike;
  readonly now?: () => Date;
  readonly timers?: TimerLike;
}

export interface ResolvedConfig {
  readonly environment: Environment;
  readonly provider: ProviderName;
  readonly http: { endpoint: string; apiKey: string | undefined } | undefined;
  readonly batchSize: number;
  readonly flushIntervalMs: number;
  readonly maxQueue: number;
  readonly timeoutMs: number;
  readonly retry: RetryPolicy;
  readonly sink: AnalyticsSink | undefined;
  readonly logger: Logger;
  readonly fetch: FetchLike | undefined;
  readonly now: () => Date;
  readonly timers: TimerLike | undefined;
}

const INJECTED = ['sink', 'logger', 'fetch', 'now', 'timers'];

const crossFieldIssues = (
  o: z.infer<typeof optionsSchema>,
  options: AnalyticsOptions,
): ConfigIssue[] => {
  const issues: ConfigIssue[] = [];
  if (o.provider === 'http' && !o.http && !options.sink)
    issues.push({ path: 'http', message: 'required for provider http' });
  if (o.environment === 'prod') {
    if (options.sink?.isFake === true)
      issues.push({ path: 'sink', message: 'fake sink refused in prod' });
    if (o.http && o.http.apiKey === undefined)
      issues.push({ path: 'http.apiKey', message: 'required in prod' });
  }
  return issues.concat(
    prodIssues({
      environment: o.environment,
      provider: o.provider,
      devOnlyProviders: options.sink ? [] : DEV_ONLY_PROVIDERS,
      urls: [{ path: 'http.endpoint', url: o.http?.endpoint }],
    }),
  );
};

/** Validates the options once; the error names fields only, never values. */
export const resolveConfig = (options: AnalyticsOptions): ResolvedConfig => {
  const o = parseOptions(optionsSchema, plainOptions(options, INJECTED), 'analytics');
  throwIfIssues(crossFieldIssues(o, options), 'analytics');
  return {
    environment: o.environment,
    provider: o.provider,
    http: o.http && { endpoint: trimSlash(o.http.endpoint), apiKey: o.http.apiKey },
    batchSize: o.batchSize ?? DEFAULTS.batchSize,
    flushIntervalMs: o.flushIntervalMs ?? DEFAULTS.flushIntervalMs,
    maxQueue: o.maxQueue ?? DEFAULTS.maxQueue,
    timeoutMs: o.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retry: resolveRetry(o.retry),
    sink: options.sink,
    logger: redactingLogger(options.logger ?? noopLogger),
    fetch: options.fetch,
    now: options.now ?? (() => new Date()),
    timers: options.timers,
  };
};
