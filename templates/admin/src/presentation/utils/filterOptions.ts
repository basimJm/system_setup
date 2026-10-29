export interface Option {
  value: string;
  label: string;
}

/** Case-insensitive "contains" match on the label; blank query keeps everything. */
export function filterOptions<T extends Option>(options: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return [...options];
  return options.filter((o) => o.label.toLocaleLowerCase().includes(needle));
}
