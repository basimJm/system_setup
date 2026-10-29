import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnPicker } from '@/presentation/components/data/ColumnPicker';
import { DataTable, type Column } from '@/presentation/components/data/DataTable';
import { DensityToggle } from '@/presentation/components/data/DensityToggle';
import { Pagination } from '@/presentation/components/data/Pagination';
import { TableToolbar } from '@/presentation/components/data/TableToolbar';
import { useColumnVisibility } from '@/presentation/hooks/useColumnVisibility';
import { TableSection } from '@/presentation/pages/design/TableSection';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';

interface Row {
  id: string;
  name: string;
}
const ROWS: Row[] = [
  { id: 'r1', name: 'Alpha' },
  { id: 'r2', name: 'Beta' },
  { id: 'r3', name: 'Gamma' },
];
const COLUMNS: Column<Row>[] = [
  { key: 'id', header: 'ID', render: (r) => r.id },
  { key: 'name', header: 'Name', render: (r) => r.name },
];

function Harness(props: {
  onRowClick?: (row: Row) => void;
  withActions?: boolean;
  initial?: string[];
  onAction?: () => void;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(props.initial ?? []));
  return (
    <>
      <output>{[...selected].sort().join(',') || 'none'}</output>
      <DataTable
        caption="Rows"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        selection={{ selected, onChange: setSelected, rowLabel: (r) => r.name }}
        {...(props.onRowClick ? { onRowClick: props.onRowClick } : {})}
        {...(props.withActions
          ? {
              rowActions: (r: Row) => (
                <button type="button" onClick={props.onAction}>
                  act {r.name}
                </button>
              ),
            }
          : {})}
      />
    </>
  );
}

describe('DataTable selection', () => {
  it('select-all selects every row on the page, then clears them', async () => {
    renderWithApp(<Harness />);
    const all = screen.getByRole('checkbox', { name: 'Select all rows on this page' });
    await userEvent.click(all);
    expect(screen.getByRole('status')).toHaveTextContent('r1,r2,r3');
    expect(all).toBeChecked();
    await userEvent.click(all);
    expect(screen.getByRole('status')).toHaveTextContent('none');
  });

  it('shows the mixed state when only some rows are selected', async () => {
    renderWithApp(<Harness />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Beta' }));
    const all = screen.getByRole('checkbox', { name: 'Select all rows on this page' });
    expect(all).not.toBeChecked();
    expect((all as HTMLInputElement).indeterminate).toBe(true);
    expect(screen.getByRole('row', { name: /Beta/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('row', { name: /Alpha/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps selected keys from other pages when toggling the page', async () => {
    renderWithApp(<Harness initial={['elsewhere']} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
    expect(screen.getByRole('status')).toHaveTextContent('elsewhere,r1,r2,r3');
  });

  it('clicking a checkbox does not open the row; clicking the row does', async () => {
    const onRowClick = vi.fn();
    renderWithApp(<Harness onRowClick={onRowClick} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    expect(onRowClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('Gamma'));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[2]);
  });
});

describe('DataTable row actions and keyboard', () => {
  it('actions render per row and never trigger the row click', async () => {
    const onRowClick = vi.fn();
    const onAction = vi.fn();
    renderWithApp(<Harness withActions onRowClick={onRowClick} onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: 'act Beta' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.getByRole('columnheader', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('Enter on the row opens it, Enter on a control inside does not', async () => {
    const onRowClick = vi.fn();
    renderWithApp(<Harness withActions onRowClick={onRowClick} />);
    const row = screen.getByRole('row', { name: /Alpha/ });
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'act Alpha' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});

describe('DataTable view options', () => {
  it('leaves hidden columns out of header and cells', () => {
    renderWithApp(
      <DataTable
        caption="Rows"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        hiddenColumns={new Set(['id'])}
      />,
    );
    expect(screen.queryByRole('columnheader', { name: 'ID' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    expect(screen.queryByText('r1')).toBeNull();
  });

  it('applies the density class', () => {
    renderWithApp(
      <DataTable
        caption="Rows"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        density="compact"
      />,
    );
    expect(screen.getByRole('table')).toHaveClass('app-table--compact');
  });

  it('skeleton rows cover the checkbox and action columns too, and select-all is hidden while loading', () => {
    renderWithApp(
      <DataTable
        caption="Rows"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        loading
        selection={{ selected: new Set(), onChange: () => undefined, rowLabel: (r) => r.name }}
        rowActions={() => null}
      />,
    );
    const firstBodyRow = within(screen.getAllByRole('rowgroup')[1] as HTMLElement).getAllByRole(
      'row',
    )[0];
    expect(within(firstBodyRow as HTMLElement).getAllByRole('cell')).toHaveLength(4);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('still shows the empty and error states instead of the table', () => {
    const { rerender } = renderWithApp(
      <DataTable caption="Rows" columns={COLUMNS} rows={[]} rowKey={(r) => r.id} />,
    );
    expect(screen.getByText('No results')).toBeVisible();
    rerender(
      <DataTable
        caption="Rows"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        emptyTitle="Nothing"
      />,
    );
    expect(screen.getByText('Nothing')).toBeVisible();
    rerender(
      <DataTable
        caption="Rows"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        error={new Error('x')}
      />,
    );
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('toolbar parts', () => {
  it('ColumnPicker toggles columns, protects the last one, closes on Escape and on outside focus', async () => {
    function PickerHarness() {
      const visibility = useColumnVisibility(COLUMNS.map((c) => c.key));
      return (
        <>
          <ColumnPicker columns={COLUMNS} visibility={visibility} />
          <output>{[...visibility.hidden].join(',') || 'none'}</output>
          <button type="button">outside</button>
        </>
      );
    }
    renderWithApp(<PickerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'ID' }));
    expect(screen.getByRole('status')).toHaveTextContent('id');
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Show all columns' }));
    expect(screen.getByRole('status')).toHaveTextContent('none');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Columns' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('group', { name: 'Columns' })).toBeNull();
  });

  it('DensityToggle reports the chosen density', async () => {
    const onChange = vi.fn();
    renderWithApp(<DensityToggle value="comfortable" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(onChange).toHaveBeenCalledWith('compact');
  });

  it('TableToolbar shows the bulk bar only with a selection, plus clear and export', async () => {
    const onClear = vi.fn();
    const onExport = vi.fn();
    const { rerender } = renderWithApp(<TableToolbar onExport={onExport} />);
    expect(screen.queryByRole('status')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    rerender(
      <TableToolbar
        selectedCount={2}
        onClearSelection={onClear}
        bulkActions={<button type="button">Bulk</button>}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('2 selected');
    expect(screen.getByRole('button', { name: 'Bulk' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('TableSection (gallery)', () => {
  it('pages, selects, counts, exports and hides columns', async () => {
    renderWithApp(
      <main>
        <TableSection />
      </main>,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
    expect(screen.getByText('25 selected')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByText('Export requested (1)')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByText('25 selected')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Region' }));
    expect(screen.queryByRole('columnheader', { name: 'Region' })).toBeNull();
    expect(await axeViolations()).toEqual([]);
  });
});

describe('numerals follow the language', () => {
  it('shows Arabic-Indic digits in the selection count and the page range', () => {
    renderWithApp(<TableToolbar selectedCount={12} />, undefined, 'ar');
    expect(screen.getByRole('status')).toHaveTextContent('محدد: ١٢');
  });

  it('formats the pagination range with the language digits', () => {
    renderWithApp(
      <Pagination
        page={2}
        pageSize={10}
        total={23}
        onPageChange={() => undefined}
        onPageSizeChange={() => undefined}
      />,
      undefined,
      'ar',
    );
    expect(screen.getByText(/١١.*٢٠.*٢٣/)).toBeVisible();
  });
});
