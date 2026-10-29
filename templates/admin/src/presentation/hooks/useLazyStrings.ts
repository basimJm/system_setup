import { useTranslation } from 'react-i18next';
import { I18N_DEFAULT_NAMESPACE, LANGUAGES } from '@/constants/i18n';
import type { LazyBundle } from '@/locales/lazy/bundle';

/**
 * Adds a lazy locale area (both languages, from `locales/lazy/<area>`) to the running i18n instance before the
 * page's first `t()` call. Idempotent: the bundles are added once per instance; switching language needs nothing more.
 */
export function useLazyStrings(bundle: LazyBundle): void {
  const { i18n } = useTranslation();
  for (const language of LANGUAGES) {
    const strings = bundle[language];
    const [firstKey] = Object.keys(strings);
    if (firstKey && i18n.getResource(language, I18N_DEFAULT_NAMESPACE, firstKey) === undefined)
      i18n.addResourceBundle(language, I18N_DEFAULT_NAMESPACE, strings, true, false);
  }
}
