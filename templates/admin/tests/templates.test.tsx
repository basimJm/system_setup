import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DetailPage } from '@/presentation/components/templates/DetailPage';
import { JsonViewer } from '@/presentation/components/templates/JsonViewer';
import { ListPage } from '@/presentation/components/templates/ListPage';
import { Timeline } from '@/presentation/components/templates/Timeline';
import { TemplatesSection } from '@/presentation/pages/design/TemplatesSection';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';
import { localInstant } from './helpers/zone';

interface Row {
  id: string;
  name: string;
}
const ROWS: Row[] = [
  { id: 'r1', name: 'Alpha' },
  { id: 'r2', name: 'Beta' },
];
const table = {
  caption: 'Rows',
  columns: [{ key: 'name', header: 'Name', render: (r: Row) => r.name }],
  rows: ROWS,
  rowKey: (r: Row) => r.id,
};
const pagination = {
  page: 1,
  pageSize: 10,
  total: 25,
  onPageChange: () => undefined,
  onPageSizeChange: () => undefined,
};

describe('ListPage', () => {
  it('lays out header, filters, toolbar, table and pagination in that order', () => {
    renderWithApp(
      <ListPage
        title="Items"
        subtitle="All items"
        actions={<button type="button">New</button>}
        filters={{
          controls: <button type="button">filter control</button>,
          active: [{ key: 'c', label: 'City: Northville', onRemove: () => undefined }],
        }}
        toolbar={{ selectedCount: 2 }}
        table={table}
        pagination={pagination}
      />,
    );
    const order = [
      screen.getByRole('heading', { level: 1, name: 'Items' }),
      screen.getByRole('button', { name: 'filter control' }),
      screen.getByText('2 selected'),
      screen.getByRole('table'),
      screen.getByRole('navigation', { name: 'Pagination' }),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getByText('All items')).toBeVisible();
    expect(screen.getByRole('button', { name: 'New' })).toBeVisible();
  });

  it('omits the filter bar and the toolbar when not given', () => {
    renderWithApp(<ListPage title="Items" table={table} />);
    expect(screen.queryByRole('region', { name: 'Filters' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    ['loading', { loading: true, rows: [] as Row[] }],
    ['empty', { rows: [] as Row[] }],
    ['failed', { error: new Error('x'), rows: [] as Row[] }],
  ])('hides the pagination while %s', (_name, extra) => {
    renderWithApp(
      <ListPage title="Items" table={{ ...table, ...extra }} pagination={pagination} />,
    );
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });
});

describe('DetailPage', () => {
  const tabs = [
    { id: 'a', label: 'Overview', content: <p>overview body</p> },
    { id: 'b', label: 'History', content: <p>history body</p> },
  ];
  const base = {
    title: 'ITEM-1',
    tabs,
    activeTab: 'a',
    onTabChange: () => undefined,
    tabsLabel: 'Sections',
  };

  it('shows header with status and actions, the active tab and the side panel', () => {
    renderWithApp(
      <MemoryRouter>
        <DetailPage
          {...base}
          status={<span>STATUS</span>}
          actions={<button type="button">Approve</button>}
          aside={<p>side facts</p>}
          back={{ to: '/items', label: 'Items' }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'ITEM-1' })).toBeVisible();
    expect(screen.getByText('STATUS')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
    expect(screen.getByText('overview body')).toBeVisible();
    expect(screen.getByText('side facts')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Items' })).toHaveAttribute('href', '/items');
  });

  it('changes tab through the callback', async () => {
    const onTabChange = vi.fn();
    renderWithApp(<DetailPage {...base} onTabChange={onTabChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(onTabChange).toHaveBeenCalledWith('b');
  });

  it('shows the error state with retry instead of the body', async () => {
    const onRetry = vi.fn();
    renderWithApp(<DetailPage {...base} error={new Error('boom')} onRetry={onRetry} />);
    expect(screen.queryByText('overview body')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a skeleton while loading, and no aside or back link when not given', () => {
    renderWithApp(<DetailPage {...base} loading />);
    expect(screen.queryByText('overview body')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('Timeline', () => {
  const entries = [
    {
      id: '2',
      title: 'Approved',
      actor: 'System',
      at: localInstant('2026-10-12', 12, 40).toISOString(),
      tone: 'green' as const,
    },
    { id: '1', title: 'Requested', at: '2026-10-11T18:20:00Z', reason: 'Because' },
  ];

  it('lists entries in the given order with actor, business-zone 12-hour time and reason', () => {
    renderWithApp(<Timeline entries={entries} ariaLabel="History" empty="none" />);
    const items = within(screen.getByRole('list', { name: 'History' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Approved');
    expect(items[0]).toHaveTextContent('System ·');
    expect(items[0]).toHaveTextContent(/12:40/);
    expect(items[1]).toHaveTextContent('Because');
    expect(items[1]!.querySelector('time')).toHaveAttribute('datetime', '2026-10-11T18:20:00Z');
  });

  it('uses Arabic digits in Arabic and shows the empty text', () => {
    const { unmount } = renderWithApp(
      <Timeline entries={entries} ariaLabel="History" empty="none" />,
      undefined,
      'ar',
    );
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(/١٢:٤٠/);
    unmount();
    renderWithApp(<Timeline entries={[]} ariaLabel="History" empty="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('JsonViewer', () => {
  it('renders scalars, nested objects and arrays, expanded to the open depth', () => {
    renderWithApp(
      <JsonViewer
        label="Payload"
        value={{
          a: 1,
          ok: true,
          nothing: null,
          name: 'x',
          list: [1, 2],
          deep: { l1: { l2: { l3: 'hidden' } } },
        }}
      />,
    );
    const region = screen.getByRole('region', { name: 'Payload' });
    expect(region).toHaveTextContent('a: 1');
    expect(region).toHaveTextContent('ok: true');
    expect(region).toHaveTextContent('nothing: null');
    expect(region).toHaveTextContent('name: "x"');
    expect(region).toHaveTextContent('2 items');
    expect(region).toHaveTextContent('1 fields');
    const l2 = [...region.querySelectorAll('details')].find((d) => d.textContent?.startsWith('l2'));
    expect(l2).toBeDefined();
    expect(l2).not.toHaveAttribute('open');
  });

  it('handles primitives at the root and a very deep value without crashing', () => {
    const { unmount } = renderWithApp(<JsonViewer label="P" value="text" />);
    expect(screen.getByRole('region', { name: 'P' })).toHaveTextContent('"text"');
    unmount();
    let deep: unknown = 'bottom';
    for (let i = 0; i < 30; i += 1) deep = { next: deep };
    renderWithApp(<JsonViewer label="D" value={deep} />);
    expect(screen.getByRole('region', { name: 'D' })).toHaveTextContent('…');
    expect(screen.getByRole('region', { name: 'D' })).not.toHaveTextContent('bottom');
  });

  it('stays left-to-right inside an Arabic page', () => {
    renderWithApp(<JsonViewer label="P" value={{ a: 1 }} />, undefined, 'ar');
    expect(screen.getByRole('region', { name: 'P' }).querySelector('[dir="ltr"]')).not.toBeNull();
  });
});

describe('TemplatesSection (gallery)', () => {
  it('works end to end and is accessible', async () => {
    renderWithApp(
      <MemoryRouter>
        <main>
          <TemplatesSection />
        </main>
      </MemoryRouter>,
    );
    expect(screen.getByRole('table', { name: 'Items' })).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'Status history' }));
    expect(screen.getByText('Record archived after 30 days without activity')).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'Raw data' }));
    expect(screen.getByRole('region', { name: 'Raw data' })).toHaveTextContent('ITEM_ARCHIVE');
    expect(await axeViolations()).toEqual([]);
  });
});
