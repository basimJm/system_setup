import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../utils/cx';
import { toggleKey } from '../../utils/selection';
import { SelectBox } from './SelectBox';
import type { Column, TableSelection } from './tableTypes';

export interface TableRowProps<Row> {
  row: Row;
  rowId: string;
  columns: readonly Column<Row>[];
  selection?: TableSelection<Row> | undefined;
  actions?: ((row: Row) => ReactNode) | undefined;
  onRowClick?: ((row: Row) => void) | undefined;
  /** Rose tint + start border (design: rows that need attention). */
  alert?: boolean;
}

export function TableRow<Row>({
  row,
  rowId,
  columns,
  selection,
  actions,
  onRowClick,
  alert = false,
}: TableRowProps<Row>) {
  const { t } = useTranslation();
  const checked = selection?.selected.has(rowId) ?? false;
  return (
    <tr
      className={cx(
        onRowClick && 'app-table__row--click',
        checked && 'app-table__row--selected',
        alert && 'app-table__row--alert',
      )}
      aria-selected={selection ? checked : undefined}
      {...(onRowClick
        ? {
            onClick: () => onRowClick(row),
            tabIndex: 0,
            onKeyDown: (event) => {
              // Enter inside a checkbox or action button belongs to that control, not to the row.
              if (event.key === 'Enter' && event.target === event.currentTarget) onRowClick(row);
            },
          }
        : {})}
    >
      {selection ? (
        <td className="app-table__select">
          <SelectBox
            label={t('table.selectRow', { name: selection.rowLabel(row) })}
            checked={checked}
            onChange={() => selection.onChange(toggleKey(selection.selected, rowId))}
          />
        </td>
      ) : null}
      {columns.map((c) => (
        <td key={c.key} dir={c.ltr ? 'ltr' : undefined}>
          {c.render(row)}
        </td>
      ))}
      {actions ? (
        <td className="app-table__actions" onClick={(event) => event.stopPropagation()}>
          {actions(row)}
        </td>
      ) : null}
    </tr>
  );
}
