import { z } from 'zod';
import type { Environment } from '../constants/codes';
import { DEFAULT_TIMEOUT_MS } from '../constants/defaults';
import { DEV_ONLY_PROVIDERS, PROVIDERS, type ProviderName } from '../constants/sdk';
import { noopLogger, redactingLogger, type Logger } from '../logger';
import type { RetryPolicy } from '../retry';
import type { __SDK_TITLE__Port } from '../types';
import {
  environmentSchema,
  parseOptions,
  plainOptions,
  positiveInt,
  prodIssues,
  resolveRetry,
  retrySchema,
  throwIfIssues,
  type ConfigIssue,
} from './common';

const optionsSchema = z
  .object({
    environment: environmentSchema,
    provider: z.enum(PROVIDERS),
    timeoutMs: positiveInt.optional(),
    retry: retrySchema.optional(),
  })
  .strict();

export interface __SDK_TITLE__Options extends z.input<typeof optionsSchema> {
  /** Required for provider `custom`: the adapter of the chosen provider. */
  readonly port?: __SDK_TITLE__Port;
  readonly logger?: Logger;
}

export interface ResolvedConfig {
  readonly environment: Environment;
  readonly provider: ProviderName;
  readonly timeoutMs: number;
  readonly retry: RetryPolicy;
  readonly port: __SDK_TITLE__Port | undefined;
  readonly logger: Logger;
}

const INJECTED = ['port', 'logger'];

/** Validates the options once; the error names fields only, never values. */
export const resolveConfig = (options: __SDK_TITLE__Options): ResolvedConfig => {
  const o = parseOptions(optionsSchema, plainOptions(options, INJECTED), '__SDK_KIND__');
  const issues: ConfigIssue[] = prodIssues({
    environment: o.environment,
    provider: o.provider,
    devOnlyProviders: DEV_ONLY_PROVIDERS,
  });
  if (o.provider === 'custom' && options.port === undefined)
    issues.push({ path: 'port', message: 'required for provider custom' });
  if (o.environment === 'prod' && options.port?.isFake === true)
    issues.push({ path: 'port', message: 'fake adapter refused in prod' });
  throwIfIssues(issues, '__SDK_KIND__');
  return {
    environment: o.environment,
    provider: o.provider,
    timeoutMs: o.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retry: resolveRetry(o.retry),
    port: options.port,
    logger: redactingLogger(options.logger ?? noopLogger),
  };
};
