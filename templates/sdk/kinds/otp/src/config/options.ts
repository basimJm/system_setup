import { z } from 'zod';
import type { Environment } from '../constants/codes';
import {
  DEFAULTS,
  DEV_ONLY_PROVIDERS,
  MAX_CODE_LENGTH,
  MIN_CODE_LENGTH,
  MIN_SECRET_LENGTH,
  PROVIDERS,
  type ProviderName,
} from '../constants/otp';
import { noopLogger, redactingLogger, type Logger } from '../logger';
import {
  environmentSchema,
  parseOptions,
  plainOptions,
  positiveInt,
  prodIssues,
  text,
  throwIfIssues,
  type ConfigIssue,
} from './common';
import type { CodeStore, OtpChannel } from '../types';

const limitsSchema = z
  .object({
    requests: positiveInt,
    windowSec: positiveInt,
    wrongCodes: positiveInt,
    blockSec: positiveInt,
  })
  .partial()
  .strict();

const optionsSchema = z
  .object({
    environment: environmentSchema,
    provider: z.enum(PROVIDERS),
    /** HMAC secret for code hashes (required for `code`; the fake provider derives one). */
    secret: text.optional(),
    codeLength: positiveInt.min(MIN_CODE_LENGTH).max(MAX_CODE_LENGTH).optional(),
    codeTtlSec: positiveInt.optional(),
    resendAfterSec: z.number().int().nonnegative().optional(),
    tokenTtlSec: positiveInt.optional(),
    limits: limitsSchema.optional(),
    /** Fake provider only: every code is this value (QA on dev). */
    fixedCode: z.string().regex(/^\d+$/).optional(),
  })
  .strict();

export interface OtpOptions extends z.input<typeof optionsSchema> {
  readonly store?: CodeStore;
  readonly channel?: OtpChannel;
  readonly logger?: Logger;
  readonly now?: () => Date;
}

export interface ResolvedConfig {
  readonly environment: Environment;
  readonly provider: ProviderName;
  readonly secret: string | undefined;
  readonly codeLength: number;
  readonly codeTtlSec: number;
  readonly resendAfterSec: number;
  readonly tokenTtlSec: number;
  readonly limits: { requests: number; windowSec: number; wrongCodes: number; blockSec: number };
  readonly fixedCode: string | undefined;
  readonly store: CodeStore | undefined;
  readonly channel: OtpChannel | undefined;
  readonly logger: Logger;
  readonly now: () => Date;
}

const INJECTED = ['store', 'channel', 'logger', 'now'];

const crossFieldIssues = (o: z.infer<typeof optionsSchema>, options: OtpOptions): ConfigIssue[] => {
  const issues: ConfigIssue[] = [];
  if (o.provider === 'code') {
    if (!options.store) issues.push({ path: 'store', message: 'required for provider code' });
    if (!options.channel) issues.push({ path: 'channel', message: 'required for provider code' });
    if (o.secret === undefined)
      issues.push({ path: 'secret', message: 'required for provider code' });
    if (o.fixedCode !== undefined)
      issues.push({ path: 'fixedCode', message: 'fake provider only' });
  }
  if (
    o.fixedCode !== undefined &&
    o.codeLength !== undefined &&
    o.fixedCode.length !== o.codeLength
  )
    issues.push({ path: 'fixedCode', message: 'must have codeLength digits' });
  if (o.environment === 'prod') {
    if (o.fixedCode !== undefined) issues.push({ path: 'fixedCode', message: 'refused in prod' });
    if (options.store?.scope === 'local')
      issues.push({ path: 'store', message: 'local store refused in prod' });
    if (options.channel?.isFake === true)
      issues.push({ path: 'channel', message: 'fake channel refused in prod' });
    if (o.secret !== undefined && o.secret.length < MIN_SECRET_LENGTH)
      issues.push({ path: 'secret', message: 'too short for prod' });
  }
  return issues.concat(
    prodIssues({
      environment: o.environment,
      provider: o.provider,
      devOnlyProviders: DEV_ONLY_PROVIDERS,
    }),
  );
};

/** Validates the options once; the error names fields only, never values. */
export const resolveConfig = (options: OtpOptions): ResolvedConfig => {
  const o = parseOptions(optionsSchema, plainOptions(options, INJECTED), 'otp');
  throwIfIssues(crossFieldIssues(o, options), 'otp');
  return {
    environment: o.environment,
    provider: o.provider,
    secret: o.secret,
    codeLength: o.codeLength ?? o.fixedCode?.length ?? DEFAULTS.codeLength,
    codeTtlSec: o.codeTtlSec ?? DEFAULTS.codeTtlSec,
    resendAfterSec: o.resendAfterSec ?? DEFAULTS.resendAfterSec,
    tokenTtlSec: o.tokenTtlSec ?? DEFAULTS.tokenTtlSec,
    limits: {
      requests: o.limits?.requests ?? DEFAULTS.limits.requests,
      windowSec: o.limits?.windowSec ?? DEFAULTS.limits.windowSec,
      wrongCodes: o.limits?.wrongCodes ?? DEFAULTS.limits.wrongCodes,
      blockSec: o.limits?.blockSec ?? DEFAULTS.limits.blockSec,
    },
    fixedCode: o.fixedCode,
    store: options.store,
    channel: options.channel,
    logger: redactingLogger(options.logger ?? noopLogger),
    now: options.now ?? (() => new Date()),
  };
};
