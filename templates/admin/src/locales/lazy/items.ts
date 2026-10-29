import ar from '../ar/items.json';
import en from '../en/items.json';
import type { LazyBundle } from './bundle';

/** Item labels, loaded with the item screens only (the sample of a lazy locale area). */
export const ITEMS_STRINGS = { ar, en } as const satisfies LazyBundle;
