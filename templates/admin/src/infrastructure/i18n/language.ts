import { STORAGE_KEYS } from '@/constants/storage';
import type { Language } from '@/constants/i18n';
import { safeStorage } from '../storage/safeStorage';
import { isLanguage } from './i18n';

export const readLanguage = (fallback: Language): Language => {
  const stored = safeStorage.get(STORAGE_KEYS.language);
  return isLanguage(stored) ? stored : fallback;
};

export const writeLanguage = (language: Language): void =>
  safeStorage.set(STORAGE_KEYS.language, language);
