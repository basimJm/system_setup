/** Languages and `Accept-Language` handling. Arabic is the default (BUSINESS_DOMAIN.md §2). */
export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'ar';
export const ACCEPT_LANGUAGE_HEADER = 'accept-language';

export const LANGUAGE_LIST_SEPARATOR = ',';
export const LANGUAGE_PARAM_SEPARATOR = ';';
export const LANGUAGE_SUBTAG_SEPARATOR = '-';
export const LANGUAGE_WILDCARD = '*';
export const DEFAULT_QUALITY = 1;
export const QUALITY_PREFIX = 'q=';

/** ICU locale used to print dates and times: Arabic uses Arabic-Indic digits and ص/م . */
export const LOCALE_TAGS: Readonly<Record<Language, string>> = {
  ar: 'ar-u-nu-arab',
  en: 'en-GB',
};
