import { useCallback, useState } from 'react';

export interface ColumnVisibility {
  hidden: ReadonlySet<string>;
  toggle: (key: string) => void;
  reset: () => void;
}

/** Which table columns the admin hid. The last visible column cannot be hidden (an empty table is useless). */
export function useColumnVisibility(allKeys: readonly string[]): ColumnVisibility {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback(
    (key: string) =>
      setHidden((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else if (allKeys.filter((k) => !current.has(k)).length > 1) next.add(key);
        return next;
      }),
    [allKeys],
  );
  const reset = useCallback(() => setHidden(new Set()), []);
  return { hidden, toggle, reset };
}
