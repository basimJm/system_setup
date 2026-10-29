import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  BUILD_ID_ENV_VAR,
  BUILD_ID_PATTERN,
  BUILD_ID_SHA_LENGTH,
  BUILD_ID_UNKNOWN,
} from '../../src/constants/env.ts';

/** Returns the short git sha of HEAD; throws when git or the checkout is unavailable. */
export type GitRunner = () => string;

const gitShortSha: GitRunner = () =>
  execFileSync('git', ['rev-parse', `--short=${BUILD_ID_SHA_LENGTH}`, 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

/**
 * Build id shown on /about: the `BUILD_ID` env var when set, else the short git sha, else "unknown".
 * Values that do not look like an id are ignored, so nothing odd is ever baked into the bundle.
 */
export function resolveBuildId(
  env: Readonly<Record<string, string | undefined>>,
  runGit: GitRunner = gitShortSha,
): string {
  const fromEnv = env[BUILD_ID_ENV_VAR]?.trim();
  if (fromEnv && BUILD_ID_PATTERN.test(fromEnv)) return fromEnv;
  try {
    const sha = runGit().trim();
    return BUILD_ID_PATTERN.test(sha) ? sha : BUILD_ID_UNKNOWN;
  } catch {
    return BUILD_ID_UNKNOWN;
  }
}

/** Reads `version` from a package.json file; returns undefined when missing or not a string. */
export function readPackageVersion(packageJsonPath: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
      return typeof parsed.version === 'string' ? parsed.version : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
