import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigError, loadConfig, readEnvSources } from '../src/config';
import {
  DEFAULT_PORT,
  ENV_KEYS,
  PORT_MAX,
  PROVIDER_ENV_KEYS,
  envFileName,
} from '../src/constants/env';

const MONGO = 'mongodb://user:s3cret@localhost/app';
const REDIS = 'redis://localhost:6379';
const SECRETS = { OTP_CODE_SECRET: 'c'.repeat(40), OTP_PROOF_SECRET: 'f'.repeat(40) };
const ALL_FAKE = {
  otp: 'fake',
  storage: 'fake',
  notifier: 'fake',
  analytics: 'fake',
  payments: 'fake',
};
const FIELD_KEY = { FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };

const validEnv = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  [ENV_KEYS.mongoUri]: MONGO,
  [ENV_KEYS.redisUrl]: REDIS,
  [ENV_KEYS.jwtAccessSecret]: 'a'.repeat(48),
  ...overrides,
});

const invalidKeysOf = (source: NodeJS.ProcessEnv): readonly string[] => {
  try {
    loadConfig(source);
  } catch (error) {
    if (error instanceof ConfigError) return error.invalidKeys;
    throw error;
  }
  throw new Error('expected loadConfig to throw');
};

describe('loadConfig', () => {
  it('applies non-secret defaults and every provider defaults to fake outside production', () => {
    const config = loadConfig(validEnv());
    expect(config.env).toBe('development');
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.corsAllowedOrigins).toEqual([]);
    expect(config.providers).toEqual(ALL_FAKE);
    expect(config.devSeed.onStart).toBe(false);
  });

  it('coerces and validates the port', () => {
    expect(loadConfig(validEnv({ PORT: '8080' })).port).toBe(8080);
    expect(invalidKeysOf(validEnv({ PORT: '0' }))).toEqual([ENV_KEYS.port]);
    expect(invalidKeysOf(validEnv({ PORT: String(PORT_MAX + 1) }))).toEqual([ENV_KEYS.port]);
  });

  it('requires both OTP secrets, different from each other, for the real OTP provider', () => {
    expect([...invalidKeysOf(validEnv({ OTP_PROVIDER: 'real' }))].sort()).toEqual(
      ['OTP_CODE_SECRET', 'OTP_PROOF_SECRET'].sort(),
    );
    expect(
      invalidKeysOf(
        validEnv({ OTP_CODE_SECRET: 's'.repeat(40), OTP_PROOF_SECRET: 's'.repeat(40) }),
      ),
    ).toEqual(['OTP_PROOF_SECRET']);
    expect(loadConfig(validEnv({ OTP_PROVIDER: 'real', ...SECRETS })).providers.otp).toBe('real');
  });

  it('rejects unknown or empty provider modes', () => {
    for (const key of PROVIDER_ENV_KEYS) {
      expect(invalidKeysOf(validEnv({ [key]: 'mock' }))).toEqual([key]);
      expect(invalidKeysOf(validEnv({ [key]: '' }))).toEqual([key]);
    }
    expect(loadConfig(validEnv({ PAYMENT_PROVIDER: 'disabled' })).providers.payments).toBe(
      'disabled',
    );
  });

  it('requires production to name every provider as real (payments real or disabled), with no fixed code or dev seed', () => {
    expect(invalidKeysOf(validEnv({ NODE_ENV: 'production' }))).toEqual([
      ...PROVIDER_ENV_KEYS,
      ENV_KEYS.paymentProvider,
    ]);
    const production = validEnv({
      NODE_ENV: 'production',
      OTP_PROVIDER: 'real',
      STORAGE_PROVIDER: 'real',
      NOTIFIER_PROVIDER: 'real',
      ANALYTICS_PROVIDER: 'real',
      PAYMENT_PROVIDER: 'disabled',
      ...SECRETS,
      ...FIELD_KEY,
    });
    expect(loadConfig(production).isProduction).toBe(true);
    expect(invalidKeysOf({ ...production, OTP_FIXED_CODE: '123456' })).toEqual([
      ENV_KEYS.otpFixedCode,
    ]);
    expect(invalidKeysOf({ ...production, SEED_DEV_ON_START: 'true' })).toEqual([
      ENV_KEYS.seedDevOnStart,
    ]);
    expect(invalidKeysOf({ ...production, PAYMENT_PROVIDER: 'fake' })).toEqual([
      ENV_KEYS.paymentProvider,
    ]);
  });

  it('never has defaults for secrets and names keys only, never values', () => {
    const error = ((): ConfigError => {
      try {
        loadConfig({ [ENV_KEYS.mongoUri]: MONGO, [ENV_KEYS.redisUrl]: REDIS });
      } catch (caught) {
        return caught as ConfigError;
      }
      throw new Error('expected a ConfigError');
    })();
    expect(error.invalidKeys).toEqual([ENV_KEYS.jwtAccessSecret]);
    expect(error.message).toContain('JWT_ACCESS_SECRET is not set');
    expect(error.message).not.toContain('s3cret');
    expect(invalidKeysOf(validEnv({ JWT_ACCESS_SECRET: 'short' }))).toEqual([
      ENV_KEYS.jwtAccessSecret,
    ]);
    expect(invalidKeysOf(validEnv({ FIELD_ENCRYPTION_KEY: 'not-base64-32-bytes' }))).toEqual([
      ENV_KEYS.fieldEncryptionKey,
    ]);
  });

  it('returns frozen config', () => {
    const config = loadConfig(validEnv());
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.providers)).toBe(true);
  });
});

describe('readEnvSources', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'env-'));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('reads .env.<NODE_ENV> and lets real environment variables win', () => {
    writeFileSync(join(directory, envFileName('test')), 'PORT=4000\nLOG_LEVEL=debug\n');
    const merged = readEnvSources({ NODE_ENV: 'test', PORT: '5000' }, directory);
    expect(merged['PORT']).toBe('5000');
    expect(merged['LOG_LEVEL']).toBe('debug');
  });

  it('works without a file', () => {
    expect(readEnvSources({ NODE_ENV: 'test' }, directory)['NODE_ENV']).toBe('test');
  });
});

describe('.env.example', () => {
  it('lists every key the config reads, with empty values', () => {
    const text = readFileSync(join(__dirname, '..', '.env.example'), 'utf8');
    const listed = text
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split('=')[0]);
    for (const key of Object.values(ENV_KEYS)) expect(listed).toContain(key);
    for (const line of text.split('\n'))
      if (/^[A-Z_]+=/.test(line)) expect(line.endsWith('=')).toBe(true);
  });
});
