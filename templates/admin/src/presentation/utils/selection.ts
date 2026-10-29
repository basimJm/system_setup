export type SelectionState = 'none' | 'some' | 'all';

/** State of the "select all" checkbox for the rows currently shown. */
export function selectionState(
  pageKeys: readonly string[],
  selected: ReadonlySet<string>,
): SelectionState {
  if (pageKeys.length === 0) return 'none';
  const count = pageKeys.filter((key) => selected.has(key)).length;
  if (count === 0) return 'none';
  return count === pageKeys.length ? 'all' : 'some';
}

export function toggleKey(selected: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Everything shown becomes selected, unless it all already is: then it all becomes unselected. Other pages are kept. */
export function togglePage(
  selected: ReadonlySet<string>,
  pageKeys: readonly string[],
): Set<string> {
  const next = new Set(selected);
  if (selectionState(pageKeys, selected) === 'all') pageKeys.forEach((key) => next.delete(key));
  else pageKeys.forEach((key) => next.add(key));
  return next;
}
