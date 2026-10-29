import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useColumnVisibility } from '@/presentation/hooks/useColumnVisibility';
import { selectionState, toggleKey, togglePage } from '@/presentation/utils/selection';

describe('selectionState', () => {
  const page = ['a', 'b', 'c'];
  it.each([
    [[], 'none'],
    [['x'], 'none'],
    [['a'], 'some'],
    [['a', 'b', 'x'], 'some'],
    [['a', 'b', 'c'], 'all'],
    [['a', 'b', 'c', 'x'], 'all'],
  ])('selected %j -> %s', (selected, expected) =>
    expect(selectionState(page, new Set(selected))).toBe(expected),
  );

  it('an empty page is never "all"', () => {
    expect(selectionState([], new Set(['a']))).toBe('none');
  });
});

describe('toggleKey / togglePage', () => {
  it('toggleKey adds and removes without mutating the input', () => {
    const start = new Set(['a']);
    const added = toggleKey(start, 'b');
    expect([...added].sort()).toEqual(['a', 'b']);
    expect(start.size).toBe(1);
    expect([...toggleKey(added, 'a')]).toEqual(['b']);
  });

  it('togglePage selects the page, keeping keys of other pages', () => {
    const next = togglePage(new Set(['other', 'a']), ['a', 'b']);
    expect([...next].sort()).toEqual(['a', 'b', 'other']);
  });

  it('togglePage unselects only this page when it is fully selected', () => {
    const next = togglePage(new Set(['other', 'a', 'b']), ['a', 'b']);
    expect([...next]).toEqual(['other']);
  });
});

describe('useColumnVisibility', () => {
  const keys = ['id', 'name', 'city'];
  it('hides and shows columns, and resets', () => {
    const { result } = renderHook(() => useColumnVisibility(keys));
    act(() => result.current.toggle('name'));
    expect([...result.current.hidden]).toEqual(['name']);
    act(() => result.current.toggle('name'));
    expect(result.current.hidden.size).toBe(0);
    act(() => result.current.toggle('id'));
    act(() => result.current.toggle('city'));
    act(() => result.current.reset());
    expect(result.current.hidden.size).toBe(0);
  });

  it('never hides the last visible column', () => {
    const { result } = renderHook(() => useColumnVisibility(keys));
    act(() => result.current.toggle('id'));
    act(() => result.current.toggle('name'));
    act(() => result.current.toggle('city'));
    expect([...result.current.hidden].sort()).toEqual(['id', 'name']);
  });
});
