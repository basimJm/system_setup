import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SKELETON_ROWS } from '@/constants/ui';
import { cx } from '../../utils/cx';
import { selectionState, togglePage } from '../../utils/selection';
import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';
import { Skeleton } from '../feedback/Skeleton';
import { TableHead } from './TableHead';
import { TableRow } from './TableRow';
import type { Column, Density, SelectionCore, SortState, TableSelection } from './tableTypes';

export type { Column, Density, SortDirection, SortState, TableSelection } from './tableTypes';

export interface DataTableProps<Row> {
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  caption: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sort?: SortState | undefined;
  onSortChange?: (sort: SortState) => void;
  onRowClick?: (row: Row) => void;
  emptyTitle?: string;
  /** Column keys to leave out (see `useColumnVisibility`). */
  hiddenColumns?: ReadonlySet<string>;
  density?: Density;
  /** Adds a checkbox column; "select all" acts on the rows shown. */
  selection?: TableSelection<Row>;
  /** Adds a trailing cell per row (buttons, menu). Clicks inside it never trigger `onRowClick`. */
  rowActions?: (row: Row) => ReactNode;
  /** Rows that need attention get the design's rose tint (failed payments, overdue refunds). */
  rowAlert?: (row: Row) => boolean;
}

function selectAllOf(selection: SelectionCore | undefined, pageKeys: readonly string[]) {
  if (!selection) return undefined;
  return {
    state: selectionState(pageKeys, selection.selected),
    onToggle: () => selection.onChange(togglePage(selection.selected, pageKeys)),
  };
}

interface FallbackArgs {
  error: unknown;
  onRetry: (() => void) | undefined;
  loading: boolean;
  empty: boolean;
  emptyTitle: string;
}

/** Error and empty states replace the table; `null` means "show the table". */
function tableFallback({ error, onRetry, loading, empty, emptyTitle }: FallbackArgs): ReactNode {
  if (error !== undefined && error !== null)
    return <ErrorState error={error} {...(onRetry ? { onRetry } : {})} />;
  if (!loading && empty) return <EmptyState title={emptyTitle} />;
  return null;
}

function visibleColumns<Row>(
  columns: readonly Column<Row>[],
  hidden: ReadonlySet<string> | undefined,
) {
  return hidden ? columns.filter((c) => !hidden.has(c.key)) : columns;
}

function SkeletonRows({ columns }: { columns: number }) {
  return Array.from({ length: SKELETON_ROWS }, (_, i) => (
    <tr key={i}>
      {Array.from({ length: columns }, (_cell, c) => (
        <td key={c}>
          <Skeleton width="half" />
        </td>
      ))}
    </tr>
  ));
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  error,
  onRetry,
  sort,
  onSortChange,
  onRowClick,
  emptyTitle,
  hiddenColumns,
  density = 'comfortable',
  selection,
  rowActions,
  rowAlert,
}: DataTableProps<Row>) {
  const { t } = useTranslation();
  const fallback = tableFallback({
    error,
    onRetry,
    loading,
    empty: rows.length === 0,
    emptyTitle: emptyTitle ?? t('table.empty'),
  });
  if (fallback) return fallback;

  const visible = visibleColumns(columns, hiddenColumns);
  const pageKeys = rows.map(rowKey);
  const columnCount = visible.length + (selection ? 1 : 0) + (rowActions ? 1 : 0);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard reachable
    <div className="app-table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className={cx('app-table', `app-table--${density}`)} aria-busy={loading || undefined}>
        <caption className="app-sr-only">{caption}</caption>
        <TableHead
          columns={visible}
          sort={sort}
          onSortChange={onSortChange}
          selectAll={loading ? undefined : selectAllOf(selection, pageKeys)}
          hasActions={rowActions !== undefined}
          actionsHeader={t('table.rowActions')}
        />
        <tbody>
          {loading ? (
            <SkeletonRows columns={columnCount} />
          ) : (
            rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                row={row}
                rowId={rowKey(row)}
                columns={visible}
                selection={selection}
                actions={rowActions}
                onRowClick={onRowClick}
                alert={rowAlert?.(row) ?? false}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
