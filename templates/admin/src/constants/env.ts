export const APP_ENVS = ['dev', 'prod'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Build variants = environment x build type (debug keeps symbols, release minifies). */
export const BUILD_VARIANTS = ['dev-debug', 'dev-release', 'prod-debug', 'prod-release'] as const;
export type BuildVariantName = (typeof BUILD_VARIANTS)[number];

export const VARIANT_SEPARATOR = '-';
export const RELEASE_TYPE = 'release';

/** Vite modes that map to a variant without naming one (dev server, tests, plain build). */
export const MODE_ALIASES: Readonly<Record<string, BuildVariantName>> = {
  development: 'dev-debug',
  test: 'dev-debug',
  production: 'prod-release',
};

export const DATA_SOURCES = ['mock', 'remote'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const ENV_KEYS = {
  apiBaseUrl: 'VITE_API_BASE_URL',
  socketUrl: 'VITE_SOCKET_URL',
  dataSource: 'VITE_DATA_SOURCE',
  defaultLanguage: 'VITE_DEFAULT_LANGUAGE',
} as const;

export const PUBLIC_ENV_PREFIX = 'VITE_';
export const HTTPS_PROTOCOL = 'https:';
/** Only the dev debug build talks to fake data by default; every other variant calls the real API. */
export const MOCK_VARIANT = 'dev-debug';
export const DEFAULT_DATA_SOURCE = 'remote';
export const DEV_DEBUG_DATA_SOURCE: DataSource = 'mock';

/** Build-time values injected by vite.config.ts (declared in vite-env.d.ts); not VITE_* env keys. */
export const BUILD_INFO_KEYS = {
  version: '__APP_VERSION__',
  buildId: '__BUILD_ID__',
} as const;

/** Optional build-machine variable that overrides the git sha (for builds outside a git checkout). */
export const BUILD_ID_ENV_VAR = 'BUILD_ID';
export const BUILD_ID_UNKNOWN = 'unknown';
export const BUILD_ID_SHA_LENGTH = 7;
export const BUILD_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
/** Loose semver: MAJOR.MINOR.PATCH with an optional pre-release/build suffix. */
export const APP_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const FALLBACK_VERSION = '0.0.0';

/** `.env.example` is parsed by `npm run check:env`: the keys listed there must equal ENV_KEYS. */
export const ENV_EXAMPLE_FILE = '.env.example';
