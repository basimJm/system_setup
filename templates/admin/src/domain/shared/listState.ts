import {
  DEFAULT_PAGE_SIZE,
  LIST_PARAMS,
  LIST_SEARCH_MAX_LENGTH,
  LIST_SORT_SEPARATOR,
  PAGE_SIZE_OPTIONS,
} from '@/constants/ui';

export type ListSortDirection = 'asc' | 'desc';
export interface ListSort {
  readonly key: string;
  readonly direction: ListSortDirection;
}

/** Everything a list screen shows, kept in the URL so a link reproduces the screen. */
export interface ListState {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly sort: ListSort | null;
  /** Selected values per filter key (multi-select filters repeat the parameter). */
  readonly filters: Readonly<Record<string, readonly string[]>>;
}

export interface ListStateOptions {
  /** Filter keys this list understands; anything else in the URL is ignored. */
  readonly filterKeys: readonly string[];
  /** Columns the list may be sorted by; an unknown sort in the URL is ignored. */
  readonly sortKeys?: readonly string[];
  readonly defaultPageSize?: number;
  readonly defaultSort?: ListSort;
}

const toPositiveInt = (raw: string | null): number | null => {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
};

const isPageSize = (n: number | null): n is number =>
  n !== null && (PAGE_SIZE_OPTIONS as readonly number[]).includes(n);

function parseSort(raw: string | null, options: ListStateOptions): ListSort | null {
  if (!raw) return options.defaultSort ?? null;
  const [key, direction, extra] = raw.split(LIST_SORT_SEPARATOR);
  const known = key && (options.sortKeys ?? []).includes(key);
  const valid = direction === 'asc' || direction === 'desc';
  return known && valid && extra === undefined ? { key, direction } : (options.defaultSort ?? null);
}

export const defaultPageSizeOf = (options: ListStateOptions): number =>
  options.defaultPageSize ?? DEFAULT_PAGE_SIZE;

/** Reads a list state from a query string; every invalid or unknown part falls back to its default. */
export function parseListState(params: URLSearchParams, options: ListStateOptions): ListState {
  const size = toPositiveInt(params.get(LIST_PARAMS.pageSize));
  const filters: Record<string, readonly string[]> = {};
  for (const key of options.filterKeys) {
    const values = [...new Set(params.getAll(key).filter((v) => v !== ''))].sort();
    if (values.length > 0) filters[key] = values;
  }
  return {
    page: toPositiveInt(params.get(LIST_PARAMS.page)) ?? 1,
    pageSize: isPageSize(size) ? size : defaultPageSizeOf(options),
    search: (params.get(LIST_PARAMS.search) ?? '').trim().slice(0, LIST_SEARCH_MAX_LENGTH),
    sort: parseSort(params.get(LIST_PARAMS.sort), options),
    filters,
  };
}

const sameSort = (a: ListSort | null, b: ListSort | null): boolean =>
  a?.key === b?.key && a?.direction === b?.direction;

/** Writes the state back, leaving out defaults so the URL stays short and equal states give equal URLs. */
export function serializeListState(state: ListState, options: ListStateOptions): URLSearchParams {
  const params = new URLSearchParams();
  if (state.page > 1) params.set(LIST_PARAMS.page, String(state.page));
  if (state.pageSize !== defaultPageSizeOf(options))
    params.set(LIST_PARAMS.pageSize, String(state.pageSize));
  if (state.search) params.set(LIST_PARAMS.search, state.search);
  if (state.sort && !sameSort(state.sort, options.defaultSort ?? null))
    params.set(LIST_PARAMS.sort, `${state.sort.key}${LIST_SORT_SEPARATOR}${state.sort.direction}`);
  for (const key of [...options.filterKeys].sort())
    for (const value of state.filters[key] ?? []) params.append(key, value);
  return params;
}

/** A change that affects what rows match (search, sort, filters, page size) restarts at page 1. */
export function applyChange(state: ListState, patch: Partial<ListState>): ListState {
  return { ...state, ...patch, page: patch.page ?? 1 };
}

export const activeFilterCount = (state: ListState): number =>
  Object.values(state.filters).reduce((n, v) => n + v.length, 0);
