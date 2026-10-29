import type { SettingGroup } from '@/domain/settings/registry';

/** Query key of the settings list (first element = operation id, so realtime/invalidations match). */
export const SETTINGS_QUERY_KEY = ['getSettings'] as const;
export const SETTING_LIST_SEPARATOR = ',';

/** Editor tabs and the groups (cards) each one holds. */
export const SETTING_TABS: ReadonlyArray<{ id: string; groups: readonly SettingGroup[] }> = [
  { id: 'rules', groups: ['otp'] },
  { id: 'security', groups: ['adminAuth', 'tokens'] },
  { id: 'limits', groups: ['pagination', 'alerts'] },
];
