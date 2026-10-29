import { createContext, useContext } from 'react';
import type { Direction, Language } from '@/constants/i18n';

export interface LanguageContextValue {
  language: Language;
  direction: Direction;
  setLanguage: (language: Language) => void;
  toggle: () => void;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside AppProviders');
  return ctx;
}
