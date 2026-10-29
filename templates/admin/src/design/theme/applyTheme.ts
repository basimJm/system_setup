import type { Direction } from '@/constants/i18n';
import type { ThemeName } from '../tokens/colors';
import { buildCssVars } from './cssVars';

export const THEME_ATTRIBUTE = 'data-theme';

/** Writes tokens + theme + direction onto <html>. Idempotent, safe to call before React mounts. */
export function applyThemeToDocument(theme: ThemeName, direction: Direction): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(buildCssVars(theme, direction))) {
    root.style.setProperty(name, value);
  }
  root.setAttribute(THEME_ATTRIBUTE, theme);
  root.setAttribute('dir', direction);
  root.style.colorScheme = theme;
}
