import { sameSettingValue } from './validate';

/** One platform setting as the server reports it: the effective value and the built-in default. */
export interface SettingEntry {
  readonly key: string;
  readonly value: unknown;
  readonly default: unknown;
  /** True while the effective value equals the default (no admin override in force). */
  readonly isDefault: boolean;
}
/** What the server answers after a change: the key and its new effective value. */
export interface SettingWrite {
  readonly key: string;
  readonly value: unknown;
}

/** Builds an entry from the server row, deriving `isDefault` from the two values. */
export const settingEntryOf = (row: {
  key: string;
  value?: unknown;
  default?: unknown;
}): SettingEntry => ({
  key: row.key,
  value: row.value,
  default: row.default,
  isDefault: sameSettingValue(row.value, row.default),
});

export interface SettingsRepository {
  list(): Promise<readonly SettingEntry[]>;
  /** Saves one setting; the server audits it with the reason. */
  update(key: string, value: unknown, reason: string): Promise<SettingWrite>;
}
