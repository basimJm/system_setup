import { useId, useMemo, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { filterOptions, type Option } from '../utils/filterOptions';

export interface UseComboboxArgs {
  options: readonly Option[];
  onPick: (option: Option) => void;
  /** Keep the list open after a pick (multi-select). */
  keepOpen?: boolean;
  /** Called by Backspace on an empty query (multi-select removes the last chip). */
  onBackspaceEmpty?: () => void;
}

/** Keyboard + filtering behaviour of the ARIA combobox pattern, shared by Combobox and MultiSelect. */
export function useCombobox({
  options,
  onPick,
  keepOpen = false,
  onBackspaceEmpty,
}: UseComboboxArgs) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const activeIndex = Math.min(active, Math.max(filtered.length - 1, 0));

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
  };
  const pick = (option: Option) => {
    onPick(option);
    setQuery('');
    if (!keepOpen) close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActive(Math.min(activeIndex + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
        break;
      case 'Enter': {
        const option = filtered[activeIndex];
        if (open && option) {
          event.preventDefault();
          pick(option);
        }
        break;
      }
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case 'Backspace':
        if (query === '') onBackspaceEmpty?.();
        break;
      default:
    }
  };

  /** Close when focus leaves the whole widget (not when it moves between its own parts). */
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  };

  return {
    open,
    setOpen,
    query,
    setQuery: (next: string) => {
      setQuery(next);
      setOpen(true);
      setActive(0);
    },
    filtered,
    activeIndex,
    listId,
    optionId: (index: number) => `${listId}-${String(index)}`,
    pick,
    onKeyDown,
    onBlur,
  };
}
