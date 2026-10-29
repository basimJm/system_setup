import { z } from 'zod';
import { MAX_PAGE_SIZE } from '../../constants/pagination';
import { SETTING_DEFAULTS, SETTING_LIMITS } from '../../constants/settings';
import { isValidTimeZone } from '../../utils/time';

const positiveInt = z.number().int().min(1);

interface Definition<S extends z.ZodType> {
  readonly schema: S;
  /** The default after passing through the schema, so it is read-only like any saved value. */
  readonly default: z.output<S>;
}

/** Fails at start-up (and in tests) if a default does not satisfy its own schema. */
const define = <S extends z.ZodType>(schema: S, defaultValue: z.input<S>): Definition<S> => ({
  schema,
  default: schema.parse(defaultValue),
});

/**
 * Every setting of docs/BUSINESS_DOMAIN.md §10: its rule for a valid value and its default.
 * Structural checks only; business ranges are product decisions.
 */
export const SETTING_DEFINITIONS = {
  timezone: define(
    z.string().refine(isValidTimeZone, { error: 'not a known time zone' }),
    SETTING_DEFAULTS.timezone,
  ),
  'otp.length': define(
    z.number().int().min(SETTING_LIMITS.otpLengthMin).max(SETTING_LIMITS.otpLengthMax),
    SETTING_DEFAULTS['otp.length'],
  ),
  'otp.resendAfterSec': define(positiveInt, SETTING_DEFAULTS['otp.resendAfterSec']),
  'otp.maxRequests': define(positiveInt, SETTING_DEFAULTS['otp.maxRequests']),
  'otp.requestWindowSec': define(positiveInt, SETTING_DEFAULTS['otp.requestWindowSec']),
  'otp.maxWrong': define(positiveInt, SETTING_DEFAULTS['otp.maxWrong']),
  'otp.blockSec': define(positiveInt, SETTING_DEFAULTS['otp.blockSec']),
  'otp.codeTtlSec': define(positiveInt, SETTING_DEFAULTS['otp.codeTtlSec']),
  'otp.proofTtlSec': define(positiveInt, SETTING_DEFAULTS['otp.proofTtlSec']),
  'auth.accessTokenTtlSec': define(positiveInt, SETTING_DEFAULTS['auth.accessTokenTtlSec']),
  'auth.refreshTokenTtlDays': define(positiveInt, SETTING_DEFAULTS['auth.refreshTokenTtlDays']),
  'admin.maxFailedLogins': define(positiveInt, SETTING_DEFAULTS['admin.maxFailedLogins']),
  'admin.lockSec': define(positiveInt, SETTING_DEFAULTS['admin.lockSec']),
  'admin.sessionIdleSec': define(positiveInt, SETTING_DEFAULTS['admin.sessionIdleSec']),
  'pagination.appPageSize': define(
    positiveInt.max(MAX_PAGE_SIZE),
    SETTING_DEFAULTS['pagination.appPageSize'],
  ),
  'pagination.adminPageSize': define(
    positiveInt.max(MAX_PAGE_SIZE),
    SETTING_DEFAULTS['pagination.adminPageSize'],
  ),
  'uploads.imageMaxMb': define(positiveInt, SETTING_DEFAULTS['uploads.imageMaxMb']),
  'uploads.docMaxMb': define(positiveInt, SETTING_DEFAULTS['uploads.docMaxMb']),
  'notifications.retentionDays': define(
    positiveInt,
    SETTING_DEFAULTS['notifications.retentionDays'],
  ),
  'items.maxPerOwner': define(positiveInt, SETTING_DEFAULTS['items.maxPerOwner']),
};

export type SettingKey = keyof typeof SETTING_DEFINITIONS;
export type SettingValue<K extends SettingKey> = z.output<
  (typeof SETTING_DEFINITIONS)[K]['schema']
>;

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

export const isSettingKey = (value: unknown): value is SettingKey =>
  typeof value === 'string' && Object.hasOwn(SETTING_DEFINITIONS, value);
