import { STORAGE_KEYS } from '@/constants/storage';
import { safeStorage } from '@/infrastructure/storage/safeStorage';
import type { ThemeName } from '../tokens/colors';

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const resolveTheme = (mode: ThemeMode, systemDark: boolean): ThemeName =>
  mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export const systemIsDark = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(SYSTEM_DARK_QUERY).matches;

export const readStoredMode = (): ThemeMode => {
  const stored = safeStorage.get(STORAGE_KEYS.theme);
  return THEME_MODES.find((m) => m === stored) ?? 'system';
};
