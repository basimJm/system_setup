import { z } from 'zod';
import {
  APP_VERSION_PATTERN,
  BUILD_ID_PATTERN,
  BUILD_ID_UNKNOWN,
  BUILD_INFO_KEYS,
  FALLBACK_VERSION,
} from '../../constants/env.ts';
import { ConfigError } from './envSchema.ts';

export interface BuildInfo {
  /** package.json version. */
  readonly version: string;
  /** Short git sha (or the BUILD_ID override); "unknown" outside a git checkout. */
  readonly buildId: string;
}

/** Used by tests and tools that build a config without the bundler's injected values. */
export const UNKNOWN_BUILD_INFO: BuildInfo = Object.freeze({
  version: FALLBACK_VERSION,
  buildId: BUILD_ID_UNKNOWN,
});

const schema = z.object({
  [BUILD_INFO_KEYS.version]: z.string().regex(APP_VERSION_PATTERN),
  [BUILD_INFO_KEYS.buildId]: z.string().regex(BUILD_ID_PATTERN),
});

/** Validates the injected build values. Throws ConfigError naming the offending keys only. */
export function parseBuildInfo(raw: { version?: unknown; buildId?: unknown }): BuildInfo {
  const parsed = schema.safeParse({
    [BUILD_INFO_KEYS.version]: raw.version,
    [BUILD_INFO_KEYS.buildId]: raw.buildId,
  });
  if (!parsed.success) {
    throw new ConfigError([...new Set(parsed.error.issues.map((i) => String(i.path[0])))]);
  }
  return Object.freeze({
    version: parsed.data[BUILD_INFO_KEYS.version],
    buildId: parsed.data[BUILD_INFO_KEYS.buildId],
  });
}
