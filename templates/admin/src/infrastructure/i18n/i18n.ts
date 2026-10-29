import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  I18N_DEFAULT_NAMESPACE,
  LANGUAGES,
  RTL_LANGUAGES,
  type Direction,
  type Language,
} from '@/constants/i18n';
import ar from '@/locales/ar';
import en from '@/locales/en';

export const directionOf = (language: Language): Direction =>
  RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';

export const isLanguage = (value: unknown): value is Language => LANGUAGES.some((l) => l === value);

/** Creates an isolated instance (tests) or the app instance. Resources are bundled: no network, no flash. */
export function createI18n(language: Language = DEFAULT_LANGUAGE): i18n {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...LANGUAGES],
    defaultNS: I18N_DEFAULT_NAMESPACE,
    resources: {
      ar: { [I18N_DEFAULT_NAMESPACE]: ar },
      en: { [I18N_DEFAULT_NAMESPACE]: en },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
  return instance;
}
