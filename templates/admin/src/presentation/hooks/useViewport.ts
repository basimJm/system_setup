import { useEffect, useState } from 'react';
import { BREAKPOINTS, type BreakpointClass, type Orientation } from '@/design/tokens/layout';

export interface Viewport {
  breakpoint: BreakpointClass;
  orientation: Orientation;
}

/** Width decides the layout class; orientation is reported for orientation-specific tweaks. */
export function classifyViewport(width: number, height: number): Viewport {
  const breakpoint: BreakpointClass =
    width >= BREAKPOINTS.expanded ? 'expanded' : width >= BREAKPOINTS.medium ? 'medium' : 'compact';
  return { breakpoint, orientation: width > height ? 'landscape' : 'portrait' };
}

const read = (): Viewport => classifyViewport(window.innerWidth, window.innerHeight);

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read);
  useEffect(() => {
    const update = () => {
      const next = read();
      setViewport((prev) =>
        prev.breakpoint === next.breakpoint && prev.orientation === next.orientation ? prev : next,
      );
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset['bp'] = viewport.breakpoint;
    document.documentElement.dataset['orientation'] = viewport.orientation;
  }, [viewport]);
  return viewport;
}
