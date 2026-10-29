import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SEARCH_DEBOUNCE_MS } from '@/constants/ui';
import {
  applyChange,
  parseListState,
  serializeListState,
  type ListSort,
  type ListState,
  type ListStateOptions,
} from '@/domain/shared/listState';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

export interface ListController {
  state: ListState;
  /** What the search box shows right now (updates on every key; the URL follows after the debounce). */
  searchInput: string;
  setSearchInput: (value: string) => void;
  /** For boxes that debounce themselves (`SearchField`): write the search to the URL now. */
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (sort: ListSort | null) => void;
  setFilter: (key: string, values: readonly string[]) => void;
  /** Several filters in one URL change (e.g. status + owner), so one does not undo the other. */
  setFilters: (changes: Readonly<Record<string, readonly string[]>>) => void;
  clearFilters: () => void;
}

/**
 * List screens keep page, size, sort, search and filters in the URL. Page, sort and filter changes add a
 * history entry (back/forward move between them); typing in the search box only replaces the entry.
 * Pass `options` as a module-level constant (a new object every render would re-parse the URL every render).
 */
export function useListController(options: ListStateOptions): ListController {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseListState(params, options), [params, options]);
  const [searchInput, setInput] = useState(state.search);
  // Only a keystroke may write the search to the URL; a stale debounced value must never undo a URL change.
  const [typed, setTyped] = useState(false);
  const [seenUrlSearch, setSeenUrlSearch] = useState(state.search);
  if (state.search !== seenUrlSearch) {
    // URL -> box (back/forward, a pasted link, "clear all"): adjusted during render, not in an effect.
    setSeenUrlSearch(state.search);
    setInput(state.search);
    setTyped(false);
  }
  const setSearchInput = useCallback((value: string) => {
    setInput(value);
    setTyped(true);
  }, []);
  const debounced = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const commit = useCallback(
    (patch: Partial<ListState>, replace = false) =>
      setParams(serializeListState(applyChange(stateRef.current, patch), options), {
        replace,
      }),
    [setParams, options],
  );

  // Typing -> URL, after the pause.
  useEffect(() => {
    const next = debounced.trim();
    if (typed && next !== stateRef.current.search) commit({ search: next }, true);
  }, [debounced, typed, commit]);

  return {
    state,
    searchInput,
    setSearchInput,
    setSearch: useCallback((value: string) => commit({ search: value.trim() }, true), [commit]),
    setPage: useCallback((page) => commit({ page }), [commit]),
    setPageSize: useCallback((pageSize) => commit({ pageSize }), [commit]),
    setSort: useCallback((sort) => commit({ sort }), [commit]),
    setFilter: useCallback(
      (key, values) => commit({ filters: { ...stateRef.current.filters, [key]: values } }),
      [commit],
    ),
    setFilters: useCallback(
      (changes) => commit({ filters: { ...stateRef.current.filters, ...changes } }),
      [commit],
    ),
    clearFilters: useCallback(() => commit({ filters: {}, search: '' }), [commit]),
  };
}
