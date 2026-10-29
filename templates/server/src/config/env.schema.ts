import { z } from 'zod';
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
  ENVIRONMENTS,
  ENV_KEYS,
  PROVIDER_ENV_KEYS,
  LIST_SEPARATOR,
  LOG_LEVELS,
  OTP_REAL_REQUIRED_KEYS,
  OTP_FIXED_CODE_PATTERN,
  OTP_SECRET_MIN_LENGTH,
  MONGO_URI_PATTERN,
  PORT_MAX,
  PORT_MIN,
  REDIS_URL_PATTERN,
} from '../constants/env';
import { JWT_SECRET_MIN_LENGTH } from '../constants/auth';
import { isEncryptionKey } from '../utils/crypto/aesGcm';
import {
  DEFAULT_PAYMENT_PROVIDER_MODE,
  PAYMENT_PROVIDER_MODES,
  PROVIDER_MODES,
  REAL_PROVIDER_MODE,
} from '../constants/providers';
import {
  DEFAULT_TRUST_PROXY_HOPS,
  TRUST_PROXY_HOPS_MAX,
  TRUST_PROXY_HOPS_MIN,
} from '../constants/security';

const splitList = (value: string): string[] =>
  value
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

/** Raw environment variables → validated, typed values. Secrets have no defaults. */
const booleanText = z.enum(['true', 'false']).transform((value) => value === 'true');
const providerMode = z.enum(PROVIDER_MODES).optional();
const paymentProviderMode = z.enum(PAYMENT_PROVIDER_MODES).optional();
const otpSecret = z.string().min(OTP_SECRET_MIN_LENGTH).optional();

export const envSchema = z
  .object({
    [ENV_KEYS.nodeEnv]: z.enum(ENVIRONMENTS).default(DEFAULT_ENVIRONMENT),
    [ENV_KEYS.port]: z.coerce.number().int().min(PORT_MIN).max(PORT_MAX).default(DEFAULT_PORT),
    [ENV_KEYS.logLevel]: z.enum(LOG_LEVELS).default(DEFAULT_LOG_LEVEL),
    [ENV_KEYS.corsAllowedOrigins]: z.string().default('').transform(splitList),
    [ENV_KEYS.trustProxyHops]: z.coerce
      .number()
      .int()
      .min(TRUST_PROXY_HOPS_MIN)
      .max(TRUST_PROXY_HOPS_MAX)
      .default(DEFAULT_TRUST_PROXY_HOPS),
    [ENV_KEYS.mongoUri]: z.string().regex(MONGO_URI_PATTERN),
    [ENV_KEYS.redisUrl]: z.string().regex(REDIS_URL_PATTERN),
    // Signs access tokens: a secret with no default, long enough for HS256.
    [ENV_KEYS.jwtAccessSecret]: z.string().min(JWT_SECRET_MIN_LENGTH),
    // Optional everywhere: features that encrypt fields answer 503 without it; never has a default.
    [ENV_KEYS.fieldEncryptionKey]: z.string().refine(isEncryptionKey).optional(),
    [ENV_KEYS.otpProvider]: providerMode,
    [ENV_KEYS.storageProvider]: providerMode,
    [ENV_KEYS.notifierProvider]: providerMode,
    [ENV_KEYS.analyticsProvider]: providerMode,
    [ENV_KEYS.paymentProvider]: paymentProviderMode,
    [ENV_KEYS.otpCodeSecret]: otpSecret,
    [ENV_KEYS.otpProofSecret]: otpSecret,
    [ENV_KEYS.otpFixedCode]: z.string().regex(OTP_FIXED_CODE_PATTERN).optional(),
    [ENV_KEYS.seedDevOnStart]: booleanText.default(false),
  })
  // Production never runs on fakes, and never guesses: every provider must be named `real`.
  .superRefine((env, context) => {
    const issue = (key: string): void => {
      context.addIssue({ code: 'custom', path: [key], message: key });
    };
    // The real OTP provider needs both secrets.
    if (env[ENV_KEYS.otpProvider] === REAL_PROVIDER_MODE) {
      for (const key of OTP_REAL_REQUIRED_KEYS) if (env[key] === undefined) issue(key);
    }
    // One secret for codes at rest, another for `otpToken`: a leak of one never forges the other.
    const codeSecret = env[ENV_KEYS.otpCodeSecret];
    if (codeSecret !== undefined && codeSecret === env[ENV_KEYS.otpProofSecret]) {
      issue(ENV_KEYS.otpProofSecret);
    }
    if (env[ENV_KEYS.nodeEnv] !== 'production') return;
    for (const key of PROVIDER_ENV_KEYS) if (env[key] !== REAL_PROVIDER_MODE) issue(key);
    // Payments: `real` or an explicit `disabled`; never a fake gateway, never a guess.
    const payments = env[ENV_KEYS.paymentProvider];
    if (payments === undefined || payments === DEFAULT_PAYMENT_PROVIDER_MODE) {
      issue(ENV_KEYS.paymentProvider);
    }
    if (env[ENV_KEYS.otpFixedCode] !== undefined) issue(ENV_KEYS.otpFixedCode);
    if (env[ENV_KEYS.seedDevOnStart]) issue(ENV_KEYS.seedDevOnStart);
  });

export type RawEnv = z.infer<typeof envSchema>;
