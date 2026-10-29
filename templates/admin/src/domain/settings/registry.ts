export type SettingGroup = 'otp' | 'adminAuth' | 'tokens' | 'pagination' | 'alerts';
export type SettingKind = 'int' | 'intList';
export type SettingUnit = 'minutes' | 'seconds' | 'days' | 'hours' | 'digits' | 'percent';

export interface SettingDefinition {
  readonly key: string;
  /** Set when the stored value is an object and this row edits one of its integer members. */
  readonly field?: string;
  readonly group: SettingGroup;
  readonly kind: SettingKind;
  readonly unit?: SettingUnit;
  /** Sanity bounds (the server validates structure only). */
  readonly min: number;
  readonly max: number;
}

type Bounds = readonly [number, number];
const row = (
  key: string,
  group: SettingGroup,
  [min, max]: Bounds,
  unit?: SettingUnit,
): SettingDefinition => ({ key, group, kind: 'int', min, max, ...(unit ? { unit } : {}) });

const member = (
  key: string,
  field: string,
  bounds: Bounds,
  unit?: SettingUnit,
): SettingDefinition => ({
  ...row(key, 'alerts', bounds, unit),
  field,
});

const PERCENT: Bounds = [0, 100];
const JOB_FAILURES = 'alerts.jobFailures';

/**
 * Every editable key the server exposes under `GET /settings` (timezone and currency are shown read-only).
 * A new setting = one row here, its label `settings.key.<key_with_underscores>` in both locales and, when it
 * opens a new group, the group in `SETTING_TABS` + `settings.group.<group>`.
 */
export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  row('otp.length', 'otp', [4, 10], 'digits'),
  row('otp.resendAfterSec', 'otp', [10, 3600], 'seconds'),
  row('otp.maxRequests', 'otp', [1, 100]),
  row('otp.requestWindowSec', 'otp', [30, 86400], 'seconds'),
  row('otp.maxWrong', 'otp', [1, 100]),
  row('otp.blockSec', 'otp', [30, 86400], 'seconds'),
  row('admin.maxFailedLogins', 'adminAuth', [1, 20]),
  row('admin.lockSec', 'adminAuth', [30, 86400], 'seconds'),
  // Up to 30 days of idle time before the panel signs the admin out.
  row('admin.sessionIdleSec', 'adminAuth', [60, 2_592_000], 'seconds'),
  row('auth.accessTokenTtlSec', 'tokens', [60, 86400], 'seconds'),
  row('auth.refreshTokenTtlDays', 'tokens', [1, 365], 'days'),
  row('pagination.appPageSize', 'pagination', [5, 100]),
  row('pagination.adminPageSize', 'pagination', [5, 100]),
  row('alerts.api5xxRatePct', 'alerts', PERCENT, 'percent'),
  row('alerts.crashesPerHour', 'alerts', [1, 10000]),
  member(JOB_FAILURES, 'count', [1, 1000]),
  member(JOB_FAILURES, 'windowMin', [1, 1440], 'minutes'),
  {
    key: 'alerts.escalationMinutes',
    group: 'alerts',
    kind: 'intList',
    unit: 'minutes',
    min: 1,
    max: 10080,
  },
];

/** Read-only platform facts shown next to the editable ones. */
export const READ_ONLY_SETTING_KEYS = ['timezone', 'currency'] as const;

/** Stable id of a row: the key, plus the member name for object settings. */
export const rowIdOf = (def: SettingDefinition): string =>
  def.field ? `${def.key}.${def.field}` : def.key;

/** i18n keys cannot contain dots: `otp.length` -> `otp_length`. */
export const settingId = (idOrKey: string): string => idOrKey.replace(/\./g, '_');

export const definitionsOf = (group: SettingGroup): readonly SettingDefinition[] =>
  SETTING_DEFINITIONS.filter((d) => d.group === group);
