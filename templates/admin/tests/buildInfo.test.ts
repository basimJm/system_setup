import { describe, expect, it } from 'vitest';
import {
  APP_VERSION_PATTERN,
  BUILD_ID_ENV_VAR,
  BUILD_ID_UNKNOWN,
  BUILD_INFO_KEYS,
  FALLBACK_VERSION,
} from '@/constants/env';
import { parseBuildInfo, UNKNOWN_BUILD_INFO } from '@/infrastructure/config/buildInfo';
import { ConfigError } from '@/infrastructure/config/envSchema';
import { buildAppConfig } from '@/infrastructure/config/appConfig';
import { readPackageVersion, resolveBuildId } from '../scripts/lib/buildInfo.ts';
import { join } from 'node:path';
import { ROOT } from './helpers/files';

const at = (name: string) => join(ROOT, name);

const sha = () => 'abc1234';
const failingGit = () => {
  throw new Error('git: not a repository');
};

describe('resolveBuildId', () => {
  it('prefers the BUILD_ID override', () => {
    expect(resolveBuildId({ [BUILD_ID_ENV_VAR]: 'release-42' }, sha)).toBe('release-42');
  });

  it('trims the override and falls back to git when it is blank', () => {
    expect(resolveBuildId({ [BUILD_ID_ENV_VAR]: '  r1 ' }, sha)).toBe('r1');
    expect(resolveBuildId({ [BUILD_ID_ENV_VAR]: '   ' }, sha)).toBe('abc1234');
    expect(resolveBuildId({}, sha)).toBe('abc1234');
  });

  it('falls back to "unknown" when git is unavailable', () => {
    expect(resolveBuildId({}, failingGit)).toBe(BUILD_ID_UNKNOWN);
  });

  it('ignores values that do not look like an id (never bakes odd text into the bundle)', () => {
    expect(resolveBuildId({ [BUILD_ID_ENV_VAR]: '"><script>' }, sha)).toBe('abc1234');
    expect(resolveBuildId({}, () => 'has spaces and\nnewlines')).toBe(BUILD_ID_UNKNOWN);
    expect(resolveBuildId({}, () => '')).toBe(BUILD_ID_UNKNOWN);
    expect(resolveBuildId({ [BUILD_ID_ENV_VAR]: 'x'.repeat(65) }, failingGit)).toBe(
      BUILD_ID_UNKNOWN,
    );
  });

  it('reads the real checkout without throwing', () => {
    expect(resolveBuildId({})).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe('readPackageVersion', () => {
  it('reads the project version and it is a valid version', () => {
    const version = readPackageVersion(at('package.json'));
    expect(version).toMatch(APP_VERSION_PATTERN);
  });

  it('returns undefined for a missing file or a file without a string version', () => {
    expect(readPackageVersion(at('does-not-exist.json'))).toBeUndefined();
    expect(readPackageVersion(at('tsconfig.json'))).toBeUndefined();
    expect(readPackageVersion(at('.prettierrc.json'))).toBeUndefined();
  });
});

describe('parseBuildInfo', () => {
  it('accepts a version and a build id and freezes the result', () => {
    const info = parseBuildInfo({ version: '1.2.3', buildId: 'abc1234' });
    expect(info).toEqual({ version: '1.2.3', buildId: 'abc1234' });
    expect(Object.isFrozen(info)).toBe(true);
  });

  it('accepts pre-release and build suffixes', () => {
    expect(parseBuildInfo({ version: '1.0.0-rc.1+build.5', buildId: 'a' }).version).toBe(
      '1.0.0-rc.1+build.5',
    );
  });

  it.each([
    [{ version: undefined, buildId: 'a' }, [BUILD_INFO_KEYS.version]],
    [{ version: '1.2', buildId: 'a' }, [BUILD_INFO_KEYS.version]],
    [{ version: '1.2.3', buildId: '' }, [BUILD_INFO_KEYS.buildId]],
    [{ version: 'x', buildId: 'a b' }, [BUILD_INFO_KEYS.version, BUILD_INFO_KEYS.buildId]],
    [{}, [BUILD_INFO_KEYS.version, BUILD_INFO_KEYS.buildId]],
  ])('rejects %j naming only %j', (raw, keys) => {
    try {
      parseBuildInfo(raw);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).keys).toEqual(keys);
    }
  });

  it('never leaks the rejected value into the error', () => {
    const secretish = 'super secret value';
    try {
      parseBuildInfo({ version: '1.2.3', buildId: secretish });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain(secretish);
    }
  });
});

describe('build info in the app config', () => {
  it('defaults to the unknown placeholder and carries injected values', () => {
    expect(buildAppConfig({}, 'dev-debug').build).toEqual(UNKNOWN_BUILD_INFO);
    expect(UNKNOWN_BUILD_INFO).toEqual({ version: FALLBACK_VERSION, buildId: BUILD_ID_UNKNOWN });
    const build = { version: '2.0.0', buildId: 'f00ba12' };
    expect(buildAppConfig({}, 'dev-debug', build).build).toEqual(build);
  });
});
