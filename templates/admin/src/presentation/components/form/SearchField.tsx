import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEARCH_DEBOUNCE_MS } from '@/constants/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Icon } from '../core/Icon';

export interface SearchFieldProps {
  /** Accessible name (also the placeholder). */
  label: string;
  /** Called with the trimmed text after the user stopped typing (500 ms), never on mount. */
  onSearch: (query: string) => void;
  initialValue?: string;
  debounceMs?: number;
}

export function SearchField({
  label,
  onSearch,
  initialValue = '',
  debounceMs = SEARCH_DEBOUNCE_MS,
}: SearchFieldProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialValue);
  const debounced = useDebouncedValue(text, debounceMs);
  const lastEmitted = useRef(initialValue.trim());
  useEffect(() => {
    const query = debounced.trim();
    if (query === lastEmitted.current) return;
    lastEmitted.current = query;
    onSearch(query);
  }, [debounced, onSearch]);
  return (
    <div className="app-search" role="search">
      <span className="app-search__icon">
        <Icon name="search" />
      </span>
      <input
        className="app-field__control app-search__input"
        type="search"
        aria-label={label}
        placeholder={label}
        value={text}
        autoComplete="off"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setText('');
        }}
      />
      {text !== '' ? (
        <button
          type="button"
          className="app-search__clear"
          aria-label={t('form.clear')}
          onClick={() => setText('')}
        >
          <Icon name="close" size="sm" />
        </button>
      ) : null}
    </div>
  );
}
