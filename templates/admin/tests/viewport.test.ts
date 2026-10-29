import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BREAKPOINTS } from '@/design/tokens/layout';
import { classifyViewport, useViewport } from '@/presentation/hooks/useViewport';

describe('classifyViewport', () => {
  it.each([
    [360, 800, 'compact', 'portrait'],
    [800, 360, 'medium', 'landscape'],
    [BREAKPOINTS.medium - 1, 900, 'compact', 'portrait'],
    [BREAKPOINTS.medium, 900, 'medium', 'portrait'],
    [BREAKPOINTS.expanded - 1, 700, 'medium', 'landscape'],
    [BREAKPOINTS.expanded, 700, 'expanded', 'landscape'],
    [1440, 900, 'expanded', 'landscape'],
    [900, 900, 'medium', 'portrait'],
  ])('%sx%s -> %s %s', (w, h, breakpoint, orientation) => {
    expect(classifyViewport(w, h)).toEqual({ breakpoint, orientation });
  });
});

describe('useViewport', () => {
  it('reacts to resize and exposes the class on <html>', () => {
    const setSize = (w: number, h: number) => {
      Object.assign(window, { innerWidth: w, innerHeight: h });
      window.dispatchEvent(new Event('resize'));
    };
    const { result } = renderHook(() => useViewport());
    act(() => setSize(390, 844));
    expect(result.current).toEqual({ breakpoint: 'compact', orientation: 'portrait' });
    expect(document.documentElement.dataset['bp']).toBe('compact');
    act(() => setSize(844, 390));
    expect(result.current).toEqual({ breakpoint: 'medium', orientation: 'landscape' });
    expect(document.documentElement.dataset['orientation']).toBe('landscape');
    act(() => setSize(1440, 900));
    expect(result.current.breakpoint).toBe('expanded');
  });
});
