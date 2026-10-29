import { z } from 'zod';
import type { Environment } from '../constants/codes';
import { DEFAULT_TIMEOUT_MS } from '../constants/defaults';
import {
  CURRENCY_PATTERN,
  DEFAULTS,
  DEV_ONLY_PROVIDERS,
  MIN_SECRET_LENGTH,
  PROVIDERS,
  type ProviderName,
} from '../constants/payments';
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

const httpSchema = z
  .object({
    baseUrl: z.url(),
    apiKey: text,
    /** Where the gateway redirects the payer; the mock builds `${checkoutUrl}/<sessionId>`. */
    checkoutUrl: z.url().optional(),
  })
  .strict();

const optionsSchema = z
  .object({
    environment: environmentSchema,
    provider: z.enum(PROVIDERS),
    /** Shared secret that signs webhooks (fake and http). */
    webhookSecret: text,
    /** Accepted currencies; empty = any ISO 4217 code. */
    currencies: z.array(z.string().regex(CURRENCY_PATTERN)).optional(),
    sessionTtlSec: positiveInt.optional(),
    webhookToleranceSec: positiveInt.optional(),
    http: httpSchema.optional(),
    timeoutMs: positiveInt.optional(),
    retry: retrySchema.optional(),
  })
  .strict();

/** Minimal `fetch` the http adapter needs; defaults to the global one. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ readonly status: number; text(): Promise<string> }>;

export interface PaymentsOptions extends z.input<typeof optionsSchema> {
  readonly logger?: Logger;
  readonly fetch?: FetchLike;
  readonly now?: () => Date;
}

export type HttpConfig = z.infer<typeof httpSchema>;

export interface ResolvedConfig {
  readonly environment: Environment;
  readonly provider: ProviderName;
  readonly webhookSecret: string;
  readonly currencies: readonly string[];
  readonly sessionTtlSec: number;
  readonly webhookToleranceSec: number;
  readonly http: HttpConfig | undefined;
  readonly timeoutMs: number;
  readonly retry: RetryPolicy;
  readonly logger: Logger;
  readonly fetch: FetchLike | undefined;
  readonly now: () => Date;
}

const INJECTED = ['logger', 'fetch', 'now'];

const crossFieldIssues = (o: z.infer<typeof optionsSchema>): ConfigIssue[] => {
  const issues: ConfigIssue[] = [];
  if (o.provider === 'http' && !o.http)
    issues.push({ path: 'http', message: 'required for provider http' });
  if (o.environment === 'prod' && o.webhookSecret.length < MIN_SECRET_LENGTH)
    issues.push({ path: 'webhookSecret', message: 'too short for prod' });
  return issues.concat(
    prodIssues({
      environment: o.environment,
      provider: o.provider,
      devOnlyProviders: DEV_ONLY_PROVIDERS,
      urls: [
        { path: 'http.baseUrl', url: o.http?.baseUrl },
        { path: 'http.checkoutUrl', url: o.http?.checkoutUrl },
      ],
    }),
  );
};

/** Validates the options once; the error names fields only, never values. */
export const resolveConfig = (options: PaymentsOptions): ResolvedConfig => {
  const o = parseOptions(optionsSchema, plainOptions(options, INJECTED), 'payments');
  throwIfIssues(crossFieldIssues(o), 'payments');
  return {
    environment: o.environment,
    provider: o.provider,
    webhookSecret: o.webhookSecret,
    currencies: o.currencies ?? [],
    sessionTtlSec: o.sessionTtlSec ?? DEFAULTS.sessionTtlSec,
    webhookToleranceSec: o.webhookToleranceSec ?? DEFAULTS.webhookToleranceSec,
    http: o.http && {
      ...o.http,
      baseUrl: trimSlash(o.http.baseUrl),
      ...(o.http.checkoutUrl === undefined ? {} : { checkoutUrl: trimSlash(o.http.checkoutUrl) }),
    },
    timeoutMs: o.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retry: resolveRetry(o.retry),
    logger: redactingLogger(options.logger ?? noopLogger),
    fetch: options.fetch,
    now: options.now ?? (() => new Date()),
  };
};
