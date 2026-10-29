import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/infrastructure/errors/AppError';

import { DataTable, type Column } from '@/presentation/components/data/DataTable';
import { Pagination, pageCount } from '@/presentation/components/data/Pagination';
import { Tabs } from '@/presentation/components/data/Tabs';
import { AsyncView } from '@/presentation/components/feedback/AsyncView';
import { ErrorBoundary } from '@/presentation/components/feedback/ErrorBoundary';
import { ErrorState } from '@/presentation/components/feedback/ErrorState';

import { useToast } from '@/presentation/components/overlay/Toast';
import ar from '@/locales/ar';
import en from '@/locales/en';
import { makeContainer, renderWithApp } from './helpers/render';

const app = (ui: React.ReactElement) => renderWithApp(ui);

interface Row {
  id: string;
  name: string;
}
const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
];
const columns: Column<Row>[] = [
  { key: 'id', header: 'Ref', render: (r) => r.id, sortable: true },
  { key: 'name', header: 'Name', render: (r) => r.name },
];

describe('DataTable', () => {
  it('renders rows with sticky semantic headers', () => {
    app(<DataTable caption="Rows" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows skeleton rows while loading, the empty state, and a retryable error', async () => {
    const onRetry = vi.fn();
    const { rerender } = app(
      <DataTable caption="Rows" columns={columns} rows={[]} rowKey={(r) => r.id} loading />,
    );
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    rerender(<DataTable caption="Rows" columns={columns} rows={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText(en.table.empty)).toBeInTheDocument();
    rerender(
      <DataTable
        caption="Rows"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        error={new AppError({ kind: 'network' })}
        onRetry={onRetry}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: en.common.retry }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('sortable header toggles asc/desc and exposes aria-sort', async () => {
    const onSort = vi.fn();
    const { rerender } = app(
      <DataTable
        caption="Rows"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onSortChange={onSort}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ref' }));
    expect(onSort).toHaveBeenLastCalledWith({ key: 'id', direction: 'asc' });
    rerender(
      <DataTable
        caption="Rows"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'id', direction: 'asc' }}
        onSortChange={onSort}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Ref' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ref' }));
    expect(onSort).toHaveBeenLastCalledWith({ key: 'id', direction: 'desc' });
  });

  it('rows are keyboard activatable', async () => {
    const onRow = vi.fn();
    app(
      <DataTable
        caption="Rows"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRow}
      />,
    );
    screen.getByText('Alpha').closest('tr')?.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRow).toHaveBeenCalledWith(rows[0]);
  });
});

describe('Pagination', () => {
  it('computes pages and disables the edges', async () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(240, 25)).toBe(10);
    const onPage = vi.fn();
    app(
      <Pagination
        page={1}
        pageSize={25}
        total={60}
        onPageChange={onPage}
        onPageSizeChange={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: en.table.previous })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: en.table.next }));
    expect(onPage).toHaveBeenCalledWith(2);
    expect(screen.getByText('1–25 of 60')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('switches panels and keeps one tab in the tab order', async () => {
    function T() {
      const [id, setId] = useState('a');
      return (
        <Tabs
          ariaLabel="x"
          activeId={id}
          onChange={setId}
          items={[
            { id: 'a', label: 'A', content: 'panel-a' },
            { id: 'b', label: 'B', content: 'panel-b' },
          ]}
        />
      );
    }
    app(<T />);
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel-b');
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('tabindex', '-1');
  });
});

describe('error handling UI', () => {
  it('ErrorState shows a localized message, trace id and retry only when useful', async () => {
    const onRetry = vi.fn();
    const { rerender } = app(
      <ErrorState error={new AppError({ kind: 'network', traceId: 't-9' })} onRetry={onRetry} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(en.errors.network);
    expect(screen.getByText(/t-9/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: en.common.retry }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<ErrorState error={new AppError({ kind: 'forbidden' })} onRetry={onRetry} />);
    expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull();
  });

  it('ErrorState prefers the server message and falls back for unknown throwables', () => {
    const { rerender } = app(
      <ErrorState error={new AppError({ kind: 'conflict', serverMessage: 'Slot taken' })} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Slot taken');
    rerender(<ErrorState error="weird" />);
    expect(screen.getByRole('alert')).toHaveTextContent(en.errors.unknown);
  });

  it('AsyncView chooses loading, error or content', () => {
    const view = (loading: boolean, error: unknown) => (
      <AsyncView loading={loading} error={error} skeleton={<p>skeleton</p>}>
        <p>content</p>
      </AsyncView>
    );
    const { rerender } = app(view(true, null));
    expect(screen.getByText('skeleton')).toBeInTheDocument();
    rerender(view(false, null));
    expect(screen.getByText('content')).toBeInTheDocument();
    rerender(view(false, new AppError({ kind: 'server' })));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('ErrorBoundary contains a render crash, reports it and can recover', async () => {
    let crash = true;
    const onError = vi.fn();
    const Bomb = () => {
      if (crash) throw new Error('boom');
      return <p>fine</p>;
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    app(
      <ErrorBoundary onError={onError}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    crash = false;
    await userEvent.click(screen.getByRole('button', { name: en.common.retry }));
    expect(screen.getByText('fine')).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('Toast', () => {
  it('shows a status message and removes it after the duration', async () => {
    vi.useFakeTimers();
    function T() {
      const toast = useToast();
      return <button onClick={() => toast.show('Saved', 'success')}>go</button>;
    }
    app(<T />);
    act(() => screen.getByRole('button', { name: 'go' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Saved')).toBeNull();
    vi.useRealTimers();
  });
});

describe('localization of base components', () => {
  it('default language is Arabic (RTL) with Arabic strings', () => {
    renderWithApp(<ErrorState error={new AppError({ kind: 'timeout' })} />, makeContainer(), 'ar');
    expect(screen.getByRole('alert')).toHaveTextContent(ar.errors.timeout);
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
