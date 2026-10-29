/** Moves `id` one place up (-1) or down (1); ids that cannot move leave the order as it is. */
export function moveId(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to] as string, next[from] as string];
  return next;
}
