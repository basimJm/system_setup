import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

/** Props to spread on the one focusable element the tooltip describes. */
export interface TooltipTriggerProps {
  'aria-describedby': string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

export interface TooltipProps {
  /** Short text; keep it supplementary (the control still needs its own accessible name). */
  content: string;
  children: (trigger: TooltipTriggerProps) => ReactNode;
}

/** Shows on hover and keyboard focus, hides on leave, blur and Escape (WCAG 1.4.13). */
export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="app-tooltip">
      {children({
        'aria-describedby': id,
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
        onKeyDown: (event) => {
          if (event.key === 'Escape') setOpen(false);
        },
      })}
      <span id={id} role="tooltip" className="app-tooltip__bubble" hidden={!open}>
        {content}
      </span>
    </span>
  );
}
