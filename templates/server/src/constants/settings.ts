import { ADMIN_PAGE_SIZE, APP_PAGE_SIZE } from './pagination';
import { DEFAULT_TIMEZONE } from './time';

/**
 * Settings: the keys an admin can change and their defaults (docs/BUSINESS_DOMAIN.md §10).
 * A key with no stored value uses its default.
 */
export const SETTING_DEFAULTS = {
  timezone: DEFAULT_TIMEZONE,
  'otp.length': 6,
  'otp.resendAfterSec': 60,
  'otp.maxRequests': 5,
  'otp.requestWindowSec': 300,
  'otp.maxWrong': 5,
  'otp.blockSec': 900,
  'otp.codeTtlSec': 300,
  'otp.proofTtlSec': 600,
  'auth.accessTokenTtlSec': 900,
  'auth.refreshTokenTtlDays': 90,
  'admin.maxFailedLogins': 5,
  'admin.lockSec': 900,
  'admin.sessionIdleSec': 172_800,
  'pagination.appPageSize': APP_PAGE_SIZE,
  'pagination.adminPageSize': ADMIN_PAGE_SIZE,
  'uploads.imageMaxMb': 10,
  'uploads.docMaxMb': 10,
  'notifications.retentionDays': 90,
  'items.maxPerOwner': 100,
} as const;

/** Structural limits applied when a value is saved; business ranges are product decisions. */
export const SETTING_LIMITS = {
  otpLengthMin: 4,
  otpLengthMax: 10,
} as const;

export const SETTINGS_COLLECTION = 'settings';

/** Redis cache of the stored settings (shared by every API instance). */
export const SETTINGS_CACHE_KEY_PARTS = {
  /** JSON list of the stored `{ key, value }` pairs. */
  overrides: 'overrides',
  /** Counter bumped on every change; guards the cache against stale writes. */
  version: 'version',
} as const;
/** Only a safety net: a change deletes the cache at once. */
export const SETTINGS_CACHE_TTL_SEC = 60;
/** The version of a cache that was never written. */
export const SETTINGS_INITIAL_VERSION = '0';
/** After a Redis failure the cache is skipped for this long. */
export const SETTINGS_REDIS_RETRY_MS = 5_000;

/** Admin settings routes and audit names. */
export const ADMIN_SETTINGS_ROUTES = { base: '/settings', byKey: '/:key' } as const;
export const SETTINGS_AUDIT = { entityType: 'setting', action: 'SETTING_UPDATE' } as const;
