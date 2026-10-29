import { describe, expect, it } from 'vitest';
import { SETTING_TABS } from '@/constants/settings';
import {
  READ_ONLY_SETTING_KEYS,
  rowIdOf,
  SETTING_DEFINITIONS,
  settingId,
} from '@/domain/settings/registry';
import { parseSetting, sameSettingValue, settingToText } from '@/domain/settings/validate';
import { MOCK_SETTING_DEFAULTS } from '@/data/mock/settingsFixture';
import en from '@/locales/en';
import ar from '@/locales/ar';

const def = (key: string) => SETTING_DEFINITIONS.find((d) => d.key === key)!;

const MOCK_KEYS = Object.keys(MOCK_SETTING_DEFAULTS);

describe('settings registry', () => {
  it('every default satisfies its own definition', () => {
    for (const d of SETTING_DEFINITIONS) {
      const stored = MOCK_SETTING_DEFAULTS[d.key];
      const value = d.field ? (stored as Record<string, unknown>)[d.field] : stored;
      expect(parseSetting(settingToText(value), d).ok, rowIdOf(d)).toBe(true);
    }
  });

  it('has a label in both languages for every key and group', () => {
    for (const d of SETTING_DEFINITIONS) {
      expect(en.settings.key).toHaveProperty(settingId(rowIdOf(d)));
      expect(ar.settings.key).toHaveProperty(settingId(rowIdOf(d)));
      expect(en.settings.group).toHaveProperty(d.group);
    }
  });
});

describe('parseSetting', () => {
  it.each([
    ['', 'required'],
    ['abc', 'integer'],
    ['1.5', 'integer'],
    ['-3', 'integer'],
    ['0', 'min'],
    ['500', 'max'],
  ])('rejects "%s" as %s', (text, error) =>
    expect(parseSetting(text, def('admin.maxFailedLogins'))).toEqual({ ok: false, error }),
  );

  it('accepts a whole number inside the bounds, trimmed', () => {
    expect(parseSetting(' 12 ', def('admin.maxFailedLogins'))).toEqual({ ok: true, value: 12 });
  });

  it('lists: comma separated, sorted largest first, no repeats, each inside the bounds', () => {
    const d = def('alerts.escalationMinutes');
    expect(parseSetting('15, 60', d)).toEqual({ ok: true, value: [60, 15] });
    expect(parseSetting('15,15', d)).toEqual({ ok: false, error: 'list' });
    expect(parseSetting(' , ', d)).toEqual({ ok: false, error: 'required' });
    expect(parseSetting('0,5', d)).toEqual({ ok: false, error: 'min' });
  });
});

describe('helpers', () => {
  it('compares values structurally and prints lists', () => {
    expect(sameSettingValue([60, 15], [60, 15])).toBe(true);
    expect(sameSettingValue(15, 16)).toBe(false);
    expect(settingToText([60, 15])).toBe('60, 15');
    expect(settingToText(undefined)).toBe('');
  });
});

describe('registry coverage', () => {
  it('every default key of the server is editable or read-only here, and nothing else is claimed', () => {
    const editable = new Set(SETTING_DEFINITIONS.map((d) => d.key));
    const readOnly = new Set(READ_ONLY_SETTING_KEYS as readonly string[]);
    for (const key of MOCK_KEYS) expect(editable.has(key) || readOnly.has(key), key).toBe(true);
    for (const key of editable) expect(MOCK_KEYS, key).toContain(key);
  });

  it('row ids are unique and every group has a label and a tab', () => {
    const ids = SETTING_DEFINITIONS.map(rowIdOf);
    expect(new Set(ids).size).toBe(ids.length);
    const inTabs = new Set(SETTING_TABS.flatMap((t) => t.groups));
    for (const d of SETTING_DEFINITIONS) {
      expect(inTabs.has(d.group), d.group).toBe(true);
      expect(en.settings.group).toHaveProperty(d.group);
      expect(ar.settings.group).toHaveProperty(d.group);
    }
  });
});
