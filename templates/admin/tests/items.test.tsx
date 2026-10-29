import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOCK_ITEMS } from '@/data/mock/itemsRoutes';
import { isItemOwnerType, isItemStatus, transitionOf } from '@/domain/items/items';
import { parseListState } from '@/domain/shared/listState';
import ItemDetailsPage from '@/presentation/items/ItemDetailsPage';
import ItemsPage from '@/presentation/items/ItemsPage';
import { ITEM_FILTER_KEYS, itemQueryOf } from '@/presentation/items/itemFilters';
import { axeViolations } from './helpers/axe';
import { makeContainer, renderWithApp } from './helpers/render';

const FIRST = MOCK_ITEMS[0]!;
const ARCHIVED = MOCK_ITEMS[2]!;
const MISSING_ID = '64d100000000000000000099';
const bodyRows = () => screen.getAllByRole('row').length - 1;
const stateOf = (search: string) =>
  parseListState(new URLSearchParams(search), { filterKeys: ITEM_FILTER_KEYS });

afterEach(() => vi.restoreAllMocks());

describe('item rules', () => {
  it('an active item archives, an archived one restores', () => {
    expect(transitionOf({ status: 'ACTIVE' })).toBe('archive');
    expect(transitionOf({ status: 'ARCHIVED' })).toBe('restore');
  });

  it('recognises the contract enums and rejects look-alikes', () => {
    expect(isItemStatus('ARCHIVED')).toBe(true);
    expect(isItemStatus('INACTIVE')).toBe(false);
    expect(isItemOwnerType('MERCHANT')).toBe(true);
    expect(isItemOwnerType('merchant')).toBe(false);
  });
});

describe('list filters -> query', () => {
  it('keeps page, size, search, a known status, owner type and tag; drops unknown values', () => {
    const q = itemQueryOf(
      stateOf('page=2&pageSize=10&q=plan&status=ACTIVE&ownerType=MERCHANT&tag=pilot'),
    );
    expect(q).toEqual({
      page: 2,
      pageSize: 10,
      q: 'plan',
      status: 'ACTIVE',
      ownerType: 'MERCHANT',
      tag: 'pilot',
    });
    const odd = itemQueryOf(stateOf('status=NOPE&ownerType=ROBOT'));
    expect(odd.status).toBeUndefined();
    expect(odd.ownerType).toBeUndefined();
    expect(odd.tag).toBeUndefined();
  });
});

describe('items repository (through the contract-typed mock)', () => {
  it('lists, searches, filters by status, owner and tag, and pages', async () => {
    const { repositories } = makeContainer();
    const all = await repositories.items.list({ page: 1, pageSize: 25 });
    expect(all.meta.total).toBe(MOCK_ITEMS.length);
    expect(all.items[0]).toMatchObject({ title: FIRST.title, description: FIRST.description });
    expect(all.items[1]?.description).toBeNull();
    const archived = await repositories.items.list({ page: 1, pageSize: 25, status: 'ARCHIVED' });
    expect(archived.items.map((i) => i.status)).toEqual(['ARCHIVED']);
    expect(archived.items[0]?.archivedReason).toBe(ARCHIVED.archivedReason);
    const found = await repositories.items.list({ page: 1, pageSize: 25, q: 'legacy' });
    expect(found.items.map((i) => i.title)).toEqual(['Legacy plan']);
    const merchants = await repositories.items.list({
      page: 1,
      pageSize: 25,
      ownerType: 'MERCHANT',
    });
    expect(merchants.meta.total).toBe(2);
    const tagged = await repositories.items.list({ page: 1, pageSize: 1, tag: 'plan' });
    expect(tagged.items).toHaveLength(1);
    expect(tagged.meta.total).toBe(2);
  });

  it('archives and restores with a reason; the wrong transition is refused with the domain code', async () => {
    const { repositories } = makeContainer();
    const archived = await repositories.items.archive(FIRST.id, 'spam listing');
    expect(archived.status).toBe('ARCHIVED');
    expect(archived.archivedReason).toBe('spam listing');
    await expect(repositories.items.archive(FIRST.id, 'again')).rejects.toMatchObject({
      kind: 'conflict',
      code: 'ITEM_ARCHIVED',
    });
    const restored = await repositories.items.restore(FIRST.id, 'owner appealed');
    expect(restored.status).toBe('ACTIVE');
    expect(restored.archivedReason).toBeNull();
    expect((await repositories.items.get(FIRST.id)).status).toBe('ACTIVE');
    await expect(repositories.items.get(MISSING_ID)).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('refuses a short reason before anything is sent', async () => {
    const { repositories } = makeContainer();
    await expect(repositories.items.archive(FIRST.id, 'x')).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});

const list = (url = '/items', container = makeContainer()) =>
  renderWithApp(
    <MemoryRouter initialEntries={[url]}>
      <main>
        <Routes>
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/items/:id" element={<ItemDetailsPage />} />
        </Routes>
      </main>
    </MemoryRouter>,
    container,
  );

describe('ItemsPage', () => {
  it('lists the items with owner and status badges and links to the record', async () => {
    list();
    await waitFor(() => expect(bodyRows()).toBe(3));
    expect(screen.getByRole('link', { name: FIRST.title })).toHaveAttribute(
      'href',
      `/items/${FIRST.id}`,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('Archived')).toBeInTheDocument();
    expect(within(table).getAllByText('Merchant')).toHaveLength(2);
    expect(await axeViolations()).toEqual([]);
  });

  it('filters by status from the URL and clears the chip', async () => {
    list('/items?status=ARCHIVED');
    await waitFor(() => expect(bodyRows()).toBe(1));
    await userEvent.click(screen.getByRole('button', { name: /Status: Archived/ }));
    await waitFor(() => expect(bodyRows()).toBe(3));
  });

  it('archives a row from its actions: the reason is required, then the list refreshes', async () => {
    list();
    await waitFor(() => expect(bodyRows()).toBe(3));
    await userEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Archive this item?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'spam listing');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByText('Archived')).toHaveLength(2),
    );
    expect(await screen.findByText('Item archived')).toBeInTheDocument();
  });

  it('restores an archived row', async () => {
    list('/items?status=ARCHIVED');
    await waitFor(() => expect(bodyRows()).toBe(1));
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restore this item?' });
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'owner appealed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Item restored')).toBeInTheDocument();
  });

  it('shows the error state with retry', async () => {
    const failing = makeContainer();
    failing.mock?.scenarios.set('serverError');
    list('/items', failing);
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders in Arabic, right to left', async () => {
    renderWithApp(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
      makeContainer(),
      'ar',
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'العناصر' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});

describe('ItemDetailsPage', () => {
  it('shows the facts, the audit history of the record, and archives with a reason', async () => {
    list(`/items/${FIRST.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: FIRST.title })).toBeInTheDocument();
    expect(screen.getByText(FIRST.description!)).toBeInTheDocument();
    expect(screen.getByText(`Customer · ${FIRST.owner.id}`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(await screen.findByText('Item update')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'spam listing');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Item archived')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeVisible();
    expect(await axeViolations()).toEqual([]);
  });

  it('a missing record shows the not-found error (no retry: it will not help) with the back link', async () => {
    list(`/items/${MISSING_ID}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to Items' })).toHaveAttribute('href', '/items');
  });
});
