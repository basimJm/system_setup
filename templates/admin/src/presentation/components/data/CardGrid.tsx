import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SKELETON_CARDS } from '@/constants/ui';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../feedback/Skeleton';

export interface CardGridProps<Row> {
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  renderCard: (row: Row) => ReactNode;
  /** Accessible name of the grid (the list title). */
  caption: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
}

/** Design `Blocks` "cards" body: a responsive grid of record cards with loading, empty and error states. */
export function CardGrid<Row>({
  rows,
  rowKey,
  renderCard,
  caption,
  loading = false,
  error,
  onRetry,
  emptyTitle,
}: CardGridProps<Row>) {
  const { t } = useTranslation();
  if (error !== undefined && error !== null)
    return <ErrorState error={error} {...(onRetry ? { onRetry } : {})} />;
  if (loading)
    return (
      <div className="app-cardgrid" aria-busy="true" aria-label={caption}>
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <div key={i} className="app-gridcard app-gridcard--skeleton">
            <Skeleton height="lg" width="full" />
            <Skeleton width="half" />
          </div>
        ))}
      </div>
    );
  if (rows.length === 0) return <EmptyState title={emptyTitle ?? t('table.empty')} />;
  return (
    <ul className="app-cardgrid" aria-label={caption}>
      {rows.map((row) => (
        <li key={rowKey(row)} className="app-cardgrid__cell">
          {renderCard(row)}
        </li>
      ))}
    </ul>
  );
}
