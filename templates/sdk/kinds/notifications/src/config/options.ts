import { z } from 'zod';
import type { Environment } from '../constants/codes';
import { DEFAULT_TIMEOUT_MS } from '../constants/defaults';
import {
  DEFAULTS,
  DEV_ONLY_PROVIDERS,
  PROVIDERS,
  type ProviderName,
} from '../constants/notifications';
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
  throwIfIssues,
  type ConfigIssue,
} from './common';
import type { EmailSender, IdempotencyStore, PushSender } from '../types';

const channelSchema = z.object({ provider: z.enum(PROVIDERS) }).strict();

const optionsSchema = z
  .object({
    environment: environmentSchema,
    /** Omit a channel the project does not use; calling it then fails with CONFIG_INVALID. */
    push: channelSchema.optional(),
    email: channelSchema.optional(),
    maxTokensPerSend: positiveInt.max(DEFAULTS.maxTokensPerSend).optional(),
    idempotencyTtlSec: positiveInt.optional(),
    timeoutMs: positiveInt.optional(),
    retry: retrySchema.optional(),
  })
  .strict();

export interface NotificationsOptions extends z.input<typeof optionsSchema> {
  readonly pushSender?: PushSender;
  readonly emailSender?: EmailSender;
  readonly idempotencyStore?: IdempotencyStore;
  readonly logger?: Logger;
  readonly now?: () => Date;
}

export interface ResolvedConfig {
  readonly environment: Environment;
  readonly push: ProviderName | undefined;
  readonly email: ProviderName | undefined;
  readonly maxTokensPerSend: number;
  readonly idempotencyTtlSec: number;
  readonly timeoutMs: number;
  readonly retry: RetryPolicy;
  readonly pushSender: PushSender | undefined;
  readonly emailSender: EmailSender | undefined;
  readonly idempotencyStore: IdempotencyStore | undefined;
  readonly logger: Logger;
  readonly now: () => Date;
}

const INJECTED = ['pushSender', 'emailSender', 'idempotencyStore', 'logger', 'now'];

const channelIssues = (
  name: 'push' | 'email',
  provider: ProviderName | undefined,
  sender: PushSender | EmailSender | undefined,
  environment: Environment,
): ConfigIssue[] => {
  if (provider === undefined) return [];
  const issues: ConfigIssue[] = [];
  if (provider === 'custom' && sender === undefined)
    issues.push({ path: `${name}Sender`, message: 'required for provider custom' });
  if (environment === 'prod' && sender?.isFake === true)
    issues.push({ path: `${name}Sender`, message: 'fake sender refused in prod' });
  return issues.concat(
    prodIssues({ environment, provider, devOnlyProviders: DEV_ONLY_PROVIDERS }).map((issue) => ({
      ...issue,
      path: `${name}.${issue.path}`,
    })),
  );
};

/** Validates the options once; the error names fields only, never values. */
export const resolveConfig = (options: NotificationsOptions): ResolvedConfig => {
  const o = parseOptions(optionsSchema, plainOptions(options, INJECTED), 'notifications');
  const issues = [
    ...channelIssues('push', o.push?.provider, options.pushSender, o.environment),
    ...channelIssues('email', o.email?.provider, options.emailSender, o.environment),
  ];
  if (o.push === undefined && o.email === undefined)
    issues.push({ path: 'push', message: 'configure push and/or email' });
  if (o.environment === 'prod' && options.idempotencyStore?.scope === 'local')
    issues.push({ path: 'idempotencyStore', message: 'local store refused in prod' });
  throwIfIssues(issues, 'notifications');
  return {
    environment: o.environment,
    push: o.push?.provider,
    email: o.email?.provider,
    maxTokensPerSend: o.maxTokensPerSend ?? DEFAULTS.maxTokensPerSend,
    idempotencyTtlSec: o.idempotencyTtlSec ?? DEFAULTS.idempotencyTtlSec,
    timeoutMs: o.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retry: resolveRetry(o.retry),
    pushSender: options.pushSender,
    emailSender: options.emailSender,
    idempotencyStore: options.idempotencyStore,
    logger: redactingLogger(options.logger ?? noopLogger),
    now: options.now ?? (() => new Date()),
  };
};
