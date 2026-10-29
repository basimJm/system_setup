import { useTranslation } from 'react-i18next';
import { Icon } from '../core/Icon';
import { SelectBox } from './SelectBox';
import type { Column, SortDirection, SortState } from './tableTypes';
import type { SelectionState } from '../../utils/selection';

export interface TableHeadProps<Row> {
  columns: readonly Column<Row>[];
  sort?: SortState | undefined;
  onSortChange?: ((sort: SortState) => void) | undefined;
  selectAll?: { state: SelectionState; onToggle: () => void } | undefined;
  hasActions: boolean;
  actionsHeader: string;
}

const nextDirection = (current: SortState | undefined, key: string): SortDirection =>
  current?.key === key && current.direction === 'asc' ? 'desc' : 'asc';

export function TableHead<Row>({
  columns,
  sort,
  onSortChange,
  selectAll,
  hasActions,
  actionsHeader,
}: TableHeadProps<Row>) {
  const { t } = useTranslation();
  return (
    <thead>
      <tr>
        {selectAll ? (
          <th scope="col" className="app-table__select">
            <SelectBox
              label={t('table.selectAll')}
              checked={selectAll.state === 'all'}
              indeterminate={selectAll.state === 'some'}
              onChange={selectAll.onToggle}
            />
          </th>
        ) : null}
        {columns.map((c) => {
          const sorted = sort?.key === c.key ? sort.direction : undefined;
          return (
            <th
              key={c.key}
              scope="col"
              aria-sort={
                sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
              }
            >
              {c.sortable && onSortChange ? (
                <button
                  type="button"
                  className="app-table__sort"
                  onClick={() =>
                    onSortChange({ key: c.key, direction: nextDirection(sort, c.key) })
                  }
                >
                  {c.header}
                  {sorted ? (
                    <Icon name={sorted === 'asc' ? 'sortUp' : 'sortDown'} size="sm" />
                  ) : null}
                </button>
              ) : (
                c.header
              )}
            </th>
          );
        })}
        {hasActions ? (
          <th scope="col" className="app-table__actions">
            <span className="app-sr-only">{actionsHeader}</span>
          </th>
        ) : null}
      </tr>
    </thead>
  );
}
