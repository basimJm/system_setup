import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../core/Button';
import { Chip } from '../core/Chip';

export interface ActiveFilter {
  key: string;
  /** Already translated, e.g. "City: Amman". */
  label: string;
  onRemove: () => void;
}

export interface FilterBarProps {
  /** The filter controls themselves (search, selects, date range). */
  children: ReactNode;
  /** One chip per filter that is currently applied. */
  active?: readonly ActiveFilter[];
  onClearAll?: () => void;
}

/** Row of filter controls with the applied filters shown as removable chips underneath. */
export function FilterBar({ children, active = [], onClearAll }: FilterBarProps) {
  const { t } = useTranslation();
  return (
    <section className="app-filterbar" aria-label={t('filters.title')}>
      <div className="app-filterbar__controls">{children}</div>
      {active.length > 0 ? (
        <ul className="app-filterbar__chips" aria-label={t('filters.active')}>
          {active.map((filter) => (
            <li key={filter.key}>
              <Chip
                tone="purple"
                onRemove={filter.onRemove}
                removeLabel={t('filters.remove', { label: filter.label })}
              >
                {filter.label}
              </Chip>
            </li>
          ))}
          {onClearAll ? (
            <li>
              <Button variant="ghost" size="sm" onClick={onClearAll}>
                {t('filters.clearAll')}
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
