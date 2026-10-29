import { ITEMS_STRINGS } from './lazy/items';

/**
 * Registry of the locale areas kept OUT of the entry bundle (tests read it: key parity, every file merged once).
 * Pages never import this file: each imports its own bundle from `locales/lazy/<area>` and registers it with
 * `useLazyStrings(bundle)`, so a screen loads only the strings it uses.
 */
export const LAZY_AREAS = {
  items: ITEMS_STRINGS,
} as const;

export type LazyArea = keyof typeof LAZY_AREAS;
/** Area files on disk that belong to a lazy area (tests check every other file is merged into the entry). */
export const LAZY_AREA_FILES: Readonly<Record<LazyArea, readonly string[]>> = {
  items: ['items.json'],
};
