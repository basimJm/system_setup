import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Keeps an absolutely positioned popover inside the viewport. It opens aligned to the end of its anchor
 * (`data-align="end"`, the CSS default) and flips to `data-align="start"` when that would cross the viewport
 * edge (narrow phones, either text direction). The attribute is set on the element directly: it is a
 * measurement of the layout, not application state.
 */
export function usePopoverAlign(open: boolean): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    panel.dataset.align = 'end';
    const { left, right } = panel.getBoundingClientRect();
    if (left < 0 || right > document.documentElement.clientWidth) panel.dataset.align = 'start';
  }, [open]);
  return ref;
}
