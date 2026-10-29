import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/constants/storage';
import { safeStorage } from '@/infrastructure/storage/safeStorage';
import type { Direction } from '@/constants/i18n';
import type { ThemeName } from '../tokens/colors';
import { applyThemeToDocument } from './applyTheme';
import { readStoredMode, resolveTheme, SYSTEM_DARK_QUERY, systemIsDark, type ThemeMode } from './themeMode';

export interface ThemeContextValue {
  mode: ThemeMode;
  theme: ThemeName;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  direction,
  children,
}: {
  direction: Direction;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState<boolean>(systemIsDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(mode, systemDark);

  useEffect(() => {
    applyThemeToDocument(theme, direction);
  }, [theme, direction]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    safeStorage.set(STORAGE_KEYS.theme, next);
  }, []);

  const toggle = useCallback(
    () => setMode(theme === 'dark' ? 'light' : 'dark'),
    [setMode, theme],
  );

  const value = useMemo(() => ({ mode, theme, setMode, toggle }), [mode, theme, setMode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
