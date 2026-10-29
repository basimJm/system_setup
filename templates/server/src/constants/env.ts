/** Environment-variable names and static rules for the config loader. */
export const ENVIRONMENTS = ['development', 'production', 'test'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const DEFAULT_ENVIRONMENT: Environment = 'development';
export const DEFAULT_PORT = 3000;
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

export const PORT_MIN = 1;
export const PORT_MAX = 65535;

/** HMAC secrets of OTP codes at rest and of `otpToken`. */
export const OTP_SECRET_MIN_LENGTH = 32;
/** Dev-only fixed code of the fake OTP channel (digits; its length must equal `otp.length`). */
export const OTP_FIXED_CODE_PATTERN = /^\d{4,10}$/;
export const MONGO_URI_PATTERN = /^mongodb(\+srv)?:\/\/\S+$/;
export const REDIS_URL_PATTERN = /^rediss?:\/\/\S+$/;

export const LIST_SEPARATOR = ',';

/** Per-environment dotenv file name, e.g. `.env.development` (never committed). */
export const envFileName = (environment: Environment): string => `.env.${environment}`;

export const ENV_KEYS = {
  nodeEnv: 'NODE_ENV',
  port: 'PORT',
  logLevel: 'LOG_LEVEL',
  corsAllowedOrigins: 'CORS_ALLOWED_ORIGINS',
  trustProxyHops: 'TRUST_PROXY_HOPS',
  mongoUri: 'MONGODB_URI',
  redisUrl: 'REDIS_URL',
  jwtAccessSecret: 'JWT_ACCESS_SECRET',
  /** Base64 of 32 random bytes: encrypts sensitive fields at rest (AES-256-GCM). Optional. */
  fieldEncryptionKey: 'FIELD_ENCRYPTION_KEY',
  otpProvider: 'OTP_PROVIDER',
  storageProvider: 'STORAGE_PROVIDER',
  notifierProvider: 'NOTIFIER_PROVIDER',
  paymentProvider: 'PAYMENT_PROVIDER',
  analyticsProvider: 'ANALYTICS_PROVIDER',
  /** HMAC secret of codes at rest (secret, >= 32 chars). Required for the real OTP provider. */
  otpCodeSecret: 'OTP_CODE_SECRET',
  /** HMAC secret of `otpToken` (secret, >= 32 chars, different from OTP_CODE_SECRET). */
  otpProofSecret: 'OTP_PROOF_SECRET',
  /** Development only: every OTP code is this value (local QA sign-in); refused in production. */
  otpFixedCode: 'OTP_FIXED_CODE',
  /** `true` runs the idempotent development seed after startup (never in production). */
  seedDevOnStart: 'SEED_DEV_ON_START',
} as const;

/** Keys that pick `fake` or `real` for an external provider; production must set them to `real`. */
export const PROVIDER_ENV_KEYS = [
  ENV_KEYS.otpProvider,
  ENV_KEYS.storageProvider,
  ENV_KEYS.notifierProvider,
  ENV_KEYS.analyticsProvider,
] as const;

/** Keys that must be present when the OTP provider is `real`. */
export const OTP_REAL_REQUIRED_KEYS = [ENV_KEYS.otpCodeSecret, ENV_KEYS.otpProofSecret] as const;
