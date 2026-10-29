import type { ReactNode } from 'react';
import { formatNumber } from '@/domain/shared/format';
import { useLanguage } from '../../hooks/useLanguage';
import { CardGrid, type CardGridProps } from '../data/CardGrid';
import { DataTable, type DataTableProps } from '../data/DataTable';
import { FilterBar, type FilterBarProps } from '../data/FilterBar';
import { Pagination, type PaginationProps } from '../data/Pagination';
import { TableToolbar, type TableToolbarProps } from '../data/TableToolbar';
import { PageHeader } from '../core/PageHeader';

interface ListPageBase {
  title: string;
  subtitle?: string;
  /** Buttons at the end of the header (create, import...). */
  actions?: ReactNode;
  /** Next to the title (e.g. the realtime "Live" pill on live lists). */
  badges?: ReactNode;
  /** Filter controls; omit for pages without filters. */
  filters?: Pick<FilterBarProps, 'active' | 'onClearAll'> & { controls: ReactNode };
  toolbar?: TableToolbarProps;
  /** Table search, drawn in the list card header (design `Blocks` table card). */
  search?: ReactNode;
  /** Export control (`ExportMenu`), drawn at the end of the list card header. */
  exportMenu?: ReactNode;
  /** Hidden while loading the first page or when the list is empty or failed. */
  pagination?: PaginationProps;
}

/** The card body is a table (most lists) or a grid of record cards (design "cards" block, e.g. banners). */
export type ListPageProps<Row> = ListPageBase &
  ({ table: DataTableProps<Row>; grid?: never } | { grid: CardGridProps<Row>; table?: never });

/**
 * Every list screen: header, filter bar, then the design's table card (title + server total, search, tools and
 * export in the card header, table with loading/empty/error built in, server pagination in the card footer).
 * Pages fill the slots; they never lay a list out themselves.
 */
export function ListPage<Row>({
  title,
  subtitle,
  actions,
  badges,
  filters,
  toolbar,
  search,
  exportMenu,
  table,
  grid,
  pagination,
}: ListPageProps<Row>) {
  const { language } = useLanguage();
  const body = grid ?? table;
  const showPagination =
    pagination !== undefined &&
    !body.loading &&
    (body.error === undefined || body.error === null) &&
    body.rows.length > 0;
  return (
    <div className="app-page app-stack">
      <PageHeader
        title={title}
        {...(subtitle ? { subtitle } : {})}
        actions={actions}
        badges={badges}
      />
      {filters ? (
        <FilterBar active={filters.active} onClearAll={filters.onClearAll}>
          {filters.controls}
        </FilterBar>
      ) : null}
      <div className="app-listcard">
        <div className="app-listcard__head">
          <div className="app-listcard__titles">
            <span className="app-listcard__title">{title}</span>
            {showPagination ? (
              <span className="app-listcard__count">
                {formatNumber(pagination.total, language)}
              </span>
            ) : null}
          </div>
          {search ? <div className="app-listcard__search">{search}</div> : null}
          {toolbar ? <TableToolbar {...toolbar} /> : null}
          {exportMenu ? <div className="app-listcard__tools">{exportMenu}</div> : null}
        </div>
        {grid ? <CardGrid {...grid} /> : <DataTable {...table} />}
        {showPagination ? <Pagination {...pagination} /> : null}
      </div>
    </div>
  );
}
