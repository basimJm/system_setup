import type { Language } from '@/constants/i18n';

/** One locale area in both languages, kept out of the entry bundle and added by `useLazyStrings`. */
export type LazyBundle = Readonly<Record<Language, object>>;
