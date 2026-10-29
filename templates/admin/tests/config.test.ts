import { describe, expect, it } from 'vitest';
import { BUILD_VARIANTS, ENV_KEYS } from '@/constants/env';
import { buildAppConfig } from '@/infrastructure/config/appConfig';
import { ConfigError, parsePublicEnv } from '@/infrastructure/config/envSchema';
import { resolveVariant } from '@/infrastructure/config/variant';

const API = 'https://api.example.test';
const SOCKET = 'https://socket.example.test';
const remoteEnv = { [ENV_KEYS.apiBaseUrl]: API, [ENV_KEYS.socketUrl]: SOCKET };

describe('build variants', () => {
  it.each([
    ['dev-debug', 'dev', true, true],
    ['dev-release', 'dev', false, false],
    ['prod-debug', 'prod', true, false],
    ['prod-release', 'prod', false, false],
  ])('%s -> env %s, debug %s, mock allowed %s', (name, env, debug, mock) => {
    expect(resolveVariant(name)).toEqual({ name, appEnv: env, debug, allowMock: mock });
  });

  it('covers exactly the four variants', () => {
    expect(BUILD_VARIANTS).toHaveLength(4);
    BUILD_VARIANTS.forEach((v) => expect(resolveVariant(v).name).toBe(v));
  });

  it('maps vite default modes and rejects unknown modes', () => {
    expect(resolveVariant('development').name).toBe('dev-debug');
    expect(resolveVariant('test').name).toBe('dev-debug');
    expect(resolveVariant('production').name).toBe('prod-release');
    expect(() => resolveVariant('staging')).toThrow(/Unknown build mode/);
  });
});

describe('public env', () => {
  it('dev debug defaults to the mock source and Arabic without any env', () => {
    const env = parsePublicEnv({}, resolveVariant('dev-debug'));
    expect(env).toMatchObject({ dataSource: 'mock', defaultLanguage: 'ar', apiBaseUrl: '' });
  });

  it('dev release defaults to the real API and therefore needs both URLs; it cannot use the mock', () => {
    expect(() => parsePublicEnv({}, resolveVariant('dev-release'))).toThrow(ConfigError);
    expect(parsePublicEnv(remoteEnv, resolveVariant('dev-release')).dataSource).toBe('remote');
    expect(() =>
      parsePublicEnv(
        { ...remoteEnv, [ENV_KEYS.dataSource]: 'mock' },
        resolveVariant('dev-release'),
      ),
    ).toThrow(ConfigError);
  });

  it('prod defaults to remote and therefore needs both URLs', () => {
    expect(() => parsePublicEnv({}, resolveVariant('prod-release'))).toThrow(ConfigError);
    expect(parsePublicEnv(remoteEnv, resolveVariant('prod-release')).dataSource).toBe('remote');
  });

  it('prod rejects the mock source, even in debug', () => {
    for (const v of ['prod-debug', 'prod-release']) {
      expect(() =>
        parsePublicEnv({ ...remoteEnv, [ENV_KEYS.dataSource]: 'mock' }, resolveVariant(v)),
      ).toThrow(ConfigError);
    }
  });

  it('prod requires https URLs', () => {
    const insecure = { ...remoteEnv, [ENV_KEYS.apiBaseUrl]: 'http://api.example.test' };
    expect(() => parsePublicEnv(insecure, resolveVariant('prod-release'))).toThrow(ConfigError);
    expect(parsePublicEnv(insecure, resolveVariant('dev-release')).apiBaseUrl).toContain('http://');
  });

  it('dev remote also needs URLs; blank values count as missing', () => {
    const raw = { [ENV_KEYS.dataSource]: 'remote', [ENV_KEYS.apiBaseUrl]: '  ' };
    try {
      parsePublicEnv(raw, resolveVariant('dev-debug'));
      expect.unreachable();
    } catch (e) {
      expect((e as ConfigError).keys).toEqual([ENV_KEYS.apiBaseUrl, ENV_KEYS.socketUrl]);
    }
  });

  it('errors name keys and never leak values', () => {
    const secretish = 'not-a-url-super-secret';
    try {
      parsePublicEnv({ [ENV_KEYS.apiBaseUrl]: secretish }, resolveVariant('dev-debug'));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain(ENV_KEYS.apiBaseUrl);
      expect((e as Error).message).not.toContain(secretish);
    }
  });

  it('rejects unknown data sources and languages', () => {
    expect(() =>
      parsePublicEnv({ [ENV_KEYS.dataSource]: 'fake' }, resolveVariant('dev-debug')),
    ).toThrow(ConfigError);
    expect(() =>
      parsePublicEnv({ [ENV_KEYS.defaultLanguage]: 'fr' }, resolveVariant('dev-debug')),
    ).toThrow(ConfigError);
  });

  it('builds a frozen config with debug logging only for debug variants', () => {
    const debug = buildAppConfig({}, 'dev-debug');
    expect(Object.isFrozen(debug)).toBe(true);
    expect(debug.logLevel).toBe('debug');
    expect(buildAppConfig(remoteEnv, 'dev-release').logLevel).toBe('warn');
  });
});
