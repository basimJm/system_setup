/**
 * What a valid value looks like, per environment key. Shown (never the value itself) when startup
 * validation fails, so a deploy log says what to fix. Keys not listed get the generic message.
 */
export const ENV_KEY_HINTS: Readonly<Record<string, string>> = {
  NODE_ENV: 'must be development, production or test',
  PORT: 'must be a whole number between 1 and 65535 (hosts that set it themselves: remove it)',
  LOG_LEVEL: 'must be one of fatal, error, warn, info, debug, trace, silent',
  TRUST_PROXY_HOPS: 'must be a whole number, 1 behind one load balancer or proxy',
  CORS_ALLOWED_ORIGINS: 'comma-separated browser addresses, e.g. https://admin.example.com',
  MONGODB_URI: 'must start with mongodb:// or mongodb+srv://',
  REDIS_URL: 'must start with redis:// or rediss://',
  JWT_ACCESS_SECRET: 'must be at least 32 characters; generate one with: openssl rand -base64 48',
  FIELD_ENCRYPTION_KEY:
    'must be 32 random bytes in base64; generate one with: openssl rand -base64 32',
  OTP_PROVIDER: 'must be real in production (fake is for development only)',
  STORAGE_PROVIDER: 'must be real in production (fake is for development only)',
  NOTIFIER_PROVIDER: 'must be real in production (fake is for development only)',
  ANALYTICS_PROVIDER: 'must be real in production (fake is for development only)',
  PAYMENT_PROVIDER: 'must be real or disabled in production (fake is for development only)',
  OTP_CODE_SECRET:
    'required when OTP_PROVIDER=real: at least 32 characters; generate one with: openssl rand -base64 48',
  OTP_PROOF_SECRET:
    'required when OTP_PROVIDER=real: at least 32 characters and different from OTP_CODE_SECRET',
  OTP_FIXED_CODE: 'development only (digits, otp.length long): remove it in production',
  SEED_DEV_ON_START: 'must be true or false; never true in production',
};
