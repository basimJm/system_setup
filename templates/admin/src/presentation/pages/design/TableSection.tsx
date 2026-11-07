import { EntityCell } from '../../components/data/TableCells';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PAGE_SIZE } from '@/constants/ui';
import { useColumnVisibility } from '../../hooks/useColumnVisibility';
import { Button } from '../../components/core/Button';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { StatusBadge } from '../../components/core/StatusBadge';
import { ColumnPicker } from '../../components/data/ColumnPicker';
import { DataTable, type Column, type Density, type SortState } from '../../components/data/DataTable';
import { DensityToggle } from '../../components/data/DensityToggle';
import { Pagination } from '../../components/data/Pagination';
import { TableToolbar } from '../../components/data/TableToolbar';

interface ItemRow {
  id: string;
  name: string;
  city: string;
  state: string;
}

const STATES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
const CITIES = ['northville', 'eastford', 'southport', 'westbury'] as const;
const ROW_COUNT = 47;
const ROWS: readonly ItemRow[] = Array.from({ length: ROW_COUNT }, (_, i) => ({
  id: `I-${String(1000 + i)}`,
  name: `${String(i + 1)}`,
  city: CITIES[i % CITIES.length] ?? 'northville',
  state: STATES[i % STATES.length] ?? 'ACTIVE',
}));

/** Gallery section for DataTable v2 (ADM-015): selection, row actions, column picker, density, paging. */
export function TableSection() {
  const { t } = useTranslation();
  const k = (key: string) => t(`design.table2.${key}`);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [density, setDensity] = useState<Density>('comfortable');
  const [sort, setSort] = useState<SortState | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exported, setExported] = useState(0);
  const columns = useMemo<readonly Column<ItemRow>[]>(
    () => [
      { key: 'id', header: k('colId'), render: (r) => r.id, ltr: true, sortable: true },
      {
        key: 'name',
        header: k('colName'),
        render: (r) => <EntityCell name={`${k('item')} ${r.name}`} sub={r.id} />,
        sortable: true,
      },
      { key: 'city', header: k('colCity'), render: (r) => k(`city.${r.city}`) },
      { key: 'state', header: k('colState'), render: (r) => <StatusBadge kind="item" value={r.state} /> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `k` only wraps `t`, which changes with the language
    [t],
  );
  const visibility = useColumnVisibility(useMemo(() => columns.map((c) => c.key), [columns]));
  const rows = useMemo(() => {
    const sorted = sort
      ? [...ROWS].sort((a, b) =>
          sort.direction === 'asc'
            ? a.id.localeCompare(b.id)
            : b.id.localeCompare(a.id),
        )
      : ROWS;
    return sorted.slice((page - 1) * pageSize, page * pageSize);
  }, [sort, page, pageSize]);

  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <TableToolbar
        selectedCount={selected.size}
        onClearSelection={() => setSelected(new Set())}
        bulkActions={<Button size="sm">{k('bulkApprove')}</Button>}
        onExport={() => setExported((n) => n + 1)}
        tools={
          <>
            <ColumnPicker columns={columns} visibility={visibility} />
            <DensityToggle value={density} onChange={setDensity} />
          </>
        }
      />
      <DataTable
        caption={k('title')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sort={sort}
        onSortChange={setSort}
        hiddenColumns={visibility.hidden}
        density={density}
        selection={{
          selected,
          onChange: setSelected,
          rowLabel: (r) => `${k('item')} ${r.name}`,
        }}
        rowActions={(r) => (
          <Button variant="ghost" size="sm">
            {k('open')} <span className="app-sr-only">{r.id}</span>
          </Button>
        )}
      />
      <Pagination
        ariaLabel={k('pagination')}
        page={page}
        pageSize={pageSize}
        total={ROW_COUNT}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
      {exported > 0 ? <p role="status">{t('design.table2.exported', { count: exported })}</p> : null}
    </Card>
  );
}
