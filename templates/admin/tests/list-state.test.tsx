import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS } from '@/constants/ui';
import {
  activeFilterCount,
  applyChange,
  parseListState,
  serializeListState,
  type ListStateOptions,
} from '@/domain/shared/listState';
import { useListController } from '@/presentation/controllers/useListController';

const options: ListStateOptions = {
  filterKeys: ['status', 'city'],
  sortKeys: ['name', 'createdAt'],
  defaultSort: { key: 'createdAt', direction: 'desc' },
};
const parse = (qs: string) => parseListState(new URLSearchParams(qs), options);

describe('parseListState', () => {
  it('returns the defaults for an empty query', () => {
    expect(parse('')).toEqual({
      page: 1,
      pageSize: 25,
      search: '',
      sort: { key: 'createdAt', direction: 'desc' },
      filters: {},
    });
  });

  it('reads page, size, search, sort and repeated filters', () => {
    const s = parse(
      'page=3&pageSize=50&q=%20noor%20&sort=name:asc&status=b&status=a&city=northville',
    );
    expect(s).toMatchObject({
      page: 3,
      pageSize: 50,
      search: 'noor',
      sort: { key: 'name', direction: 'asc' },
    });
    expect(s.filters).toEqual({ status: ['a', 'b'], city: ['northville'] });
  });

  it.each(['page=0', 'page=-2', 'page=1.5', 'page=abc', 'page=99999999999999999999'])(
    'ignores the invalid page %s',
    (qs) => expect(parse(qs).page).toBe(1),
  );

  it.each(['pageSize=7', 'pageSize=0', 'pageSize=x'])('ignores the invalid size %s', (qs) =>
    expect(parse(qs).pageSize).toBe(25),
  );

  it.each(['sort=hack:asc', 'sort=name:up', 'sort=name', 'sort=name:asc:x'])(
    'ignores the invalid sort %s',
    (qs) => expect(parse(qs).sort).toEqual({ key: 'createdAt', direction: 'desc' }),
  );

  it('ignores unknown filter keys and empty values, and caps the search length', () => {
    const s = parse(`evil=1&status=&q=${'x'.repeat(500)}`);
    expect(s.filters).toEqual({});
    expect(s.search).toHaveLength(100);
  });
});

describe('serializeListState', () => {
  it('leaves out defaults so the URL is short', () => {
    expect(serializeListState(parse(''), options).toString()).toBe('');
  });

  it('round-trips and gives equal states equal URLs', () => {
    const qs = 'page=2&pageSize=10&q=a&sort=name%3Aasc&city=x&status=a&status=b';
    const state = parse(qs);
    const out = serializeListState(state, options);
    expect(parse(out.toString())).toEqual(state);
    expect(
      serializeListState(
        parse('status=b&status=a&city=x&q=a&page=2&pageSize=10&sort=name:asc'),
        options,
      ).toString(),
    ).toBe(out.toString());
  });
});

describe('applyChange / activeFilterCount', () => {
  it('goes back to page 1 unless the page itself changes', () => {
    const s = parse('page=4');
    expect(applyChange(s, { search: 'x' }).page).toBe(1);
    expect(applyChange(s, { page: 5 }).page).toBe(5);
  });

  it('counts selected filter values', () => {
    expect(activeFilterCount(parse('status=a&status=b&city=x'))).toBe(3);
  });
});

function Probe() {
  const list = useListController(options);
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <input
        aria-label="search"
        value={list.searchInput}
        onChange={(e) => list.setSearchInput(e.target.value)}
      />
      <button onClick={() => list.setPage(3)}>page3</button>
      <button onClick={() => list.setFilter('status', ['open'])}>filter</button>
      <button onClick={() => list.setSort({ key: 'name', direction: 'asc' })}>sort</button>
      <button onClick={() => list.clearFilters()}>clear</button>
      <button onClick={() => void navigate(-1)}>back</button>
      <output>{location.search}</output>
      <output aria-label="page">{list.state.page}</output>
    </>
  );
}
const renderProbe = (initial = '/list') =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Probe />
    </MemoryRouter>,
  );
const url = () => screen.getAllByRole('status')[0]?.textContent;

describe('useListController', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('writes search to the URL only after the debounce and restarts at page 1', async () => {
    renderProbe('/list?page=4');
    const box = screen.getByRole('textbox', { name: 'search' });
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(box, 'noor');
    expect(url()).toBe('?page=4');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10));
    expect(url()).toBe('?q=noor');
  });

  it('page, filter and sort changes are history entries that back undoes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderProbe();
    await user.click(screen.getByText('page3'));
    expect(url()).toBe('?page=3');
    await user.click(screen.getByText('filter'));
    expect(url()).toBe('?status=open');
    await user.click(screen.getByText('sort'));
    expect(url()).toBe('?sort=name%3Aasc&status=open');
    await user.click(screen.getByText('back'));
    expect(url()).toBe('?status=open');
  });

  it('the box follows the URL when it changes from outside, and clear all empties it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderProbe('/list?q=maha&status=open');
    expect(screen.getByRole('textbox', { name: 'search' })).toHaveValue('maha');
    await user.click(screen.getByText('clear'));
    expect(url()).toBe('');
    expect(screen.getByRole('textbox', { name: 'search' })).toHaveValue('');
  });
});
