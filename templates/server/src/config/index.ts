import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { ENV_KEY_HINTS } from '../constants/envHints';
import {
  DEFAULT_ENVIRONMENT,
  ENVIRONMENTS,
  ENV_KEYS,
  envFileName,
  type Environment,
  type LogLevel,
} from '../constants/env';
import {
  DEFAULT_PAYMENT_PROVIDER_MODE,
  DEFAULT_PROVIDER_MODE,
  type PaymentProviderMode,
  type ProviderMode,
} from '../constants/providers';
import { envSchema, type RawEnv } from './env.schema';

/**
 * Phone OTP secrets. Required for the real provider; the fake provider makes per-process secrets
 * when they are unset.
 */
export interface OtpSettings {
  readonly codeSecret?: string;
  readonly proofSecret?: string;
  /** Development only: every code is this value (refused in production). */
  readonly fixedCode?: string;
}

export interface AppConfig {
  readonly env: Environment;
  readonly isProduction: boolean;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly corsAllowedOrigins: readonly string[];
  /** Number of reverse proxies in front of the app (load balancer = 1); 0 = trust none. */
  readonly trustProxyHops: number;
  readonly mongo: { readonly uri: string };
  readonly redis: { readonly url: string };
  readonly auth: { readonly accessSecret: string };
  /** Encryption keys for fields at rest; an absent key switches the dependent features off. */
  readonly secrets: { readonly fieldEncryptionKey?: string };
  readonly otp: OtpSettings;
  /** `fake` = in-repo stand-in (dev/test only), `real` = the adapter in `src/providers/<name>/real.ts`. */
  readonly providers: {
    readonly otp: ProviderMode;
    readonly storage: ProviderMode;
    readonly notifier: ProviderMode;
    readonly analytics: ProviderMode;
    /** `disabled` answers 503 on every gateway call. */
    readonly payments: PaymentProviderMode;
  };
  /** Development data: run the idempotent dev seed after startup. */
  readonly devSeed: { readonly onStart: boolean };
}

/** One invalid environment key and why. Never carries the value. */
export interface ConfigProblem {
  readonly key: string;
  readonly reason: string;
}

const PROBLEM_MISSING = 'is not set';
const PROBLEM_EMPTY = 'is set but empty';
const PROBLEM_INVALID = 'has an invalid value';

const describeProblem = (key: string, source: NodeJS.ProcessEnv): ConfigProblem => {
  const raw = source[key];
  const state =
    raw === undefined ? PROBLEM_MISSING : raw.trim() === '' ? PROBLEM_EMPTY : PROBLEM_INVALID;
  const hint = ENV_KEY_HINTS[key];
  return { key, reason: hint === undefined ? state : `${state}; ${hint}` };
};

/**
 * Thrown at startup when the environment is invalid. Names every bad key and why (missing, empty
 * or invalid, with what a valid value looks like), never the values.
 */
export class ConfigError extends Error {
  readonly invalidKeys: readonly string[];
  readonly problems: readonly ConfigProblem[];

  constructor(problems: readonly ConfigProblem[]) {
    super(
      [
        `Invalid environment configuration: ${String(problems.length)} problem(s). Fix them in the host's environment settings and redeploy:`,
        ...problems.map((problem) => `  - ${problem.key} ${problem.reason}`),
      ].join('\n'),
    );
    this.name = 'ConfigError';
    this.problems = problems;
    this.invalidKeys = problems.map((problem) => problem.key);
  }
}

const isEnvironment = (value: string | undefined): value is Environment =>
  ENVIRONMENTS.some((environment) => environment === value);

/**
 * Merges `.env.<NODE_ENV>` (if present) under the real process environment.
 * Real environment variables always win, so hosts and CI can override files.
 */
export const readEnvSources = (
  processEnv: NodeJS.ProcessEnv = process.env,
  directory: string = process.cwd(),
): NodeJS.ProcessEnv => {
  const requested = processEnv[ENV_KEYS.nodeEnv];
  const environment = isEnvironment(requested) ? requested : DEFAULT_ENVIRONMENT;
  const filePath = join(directory, envFileName(environment));
  const fromFile = existsSync(filePath) ? parseEnv(readFileSync(filePath, 'utf8')) : {};
  return { ...fromFile, ...processEnv };
};

const buildOtpSettings = (values: RawEnv): OtpSettings => {
  const codeSecret = values[ENV_KEYS.otpCodeSecret];
  const proofSecret = values[ENV_KEYS.otpProofSecret];
  const fixedCode = values[ENV_KEYS.otpFixedCode];
  return Object.freeze({
    ...(codeSecret === undefined ? {} : { codeSecret }),
    ...(proofSecret === undefined ? {} : { proofSecret }),
    ...(fixedCode === undefined ? {} : { fixedCode }),
  });
};

/** Validates the environment and returns an immutable, typed config. Fails fast. */
export const loadConfig = (source: NodeJS.ProcessEnv = readEnvSources()): AppConfig => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const keys = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
    throw new ConfigError([...keys].map((key) => describeProblem(key, source)));
  }
  const values = parsed.data;
  const env = values[ENV_KEYS.nodeEnv];
  const fieldKey = values[ENV_KEYS.fieldEncryptionKey];
  return Object.freeze({
    env,
    isProduction: env === 'production',
    port: values[ENV_KEYS.port],
    logLevel: values[ENV_KEYS.logLevel],
    corsAllowedOrigins: Object.freeze(values[ENV_KEYS.corsAllowedOrigins]),
    trustProxyHops: values[ENV_KEYS.trustProxyHops],
    mongo: Object.freeze({ uri: values[ENV_KEYS.mongoUri] }),
    redis: Object.freeze({ url: values[ENV_KEYS.redisUrl] }),
    auth: Object.freeze({ accessSecret: values[ENV_KEYS.jwtAccessSecret] }),
    secrets: Object.freeze(fieldKey === undefined ? {} : { fieldEncryptionKey: fieldKey }),
    otp: buildOtpSettings(values),
    providers: Object.freeze({
      otp: values[ENV_KEYS.otpProvider] ?? DEFAULT_PROVIDER_MODE,
      storage: values[ENV_KEYS.storageProvider] ?? DEFAULT_PROVIDER_MODE,
      notifier: values[ENV_KEYS.notifierProvider] ?? DEFAULT_PROVIDER_MODE,
      analytics: values[ENV_KEYS.analyticsProvider] ?? DEFAULT_PROVIDER_MODE,
      payments: values[ENV_KEYS.paymentProvider] ?? DEFAULT_PAYMENT_PROVIDER_MODE,
    }),
    devSeed: Object.freeze({ onStart: values[ENV_KEYS.seedDevOnStart] }),
  });
};
