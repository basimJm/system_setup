import { useId, useState, type ReactNode } from 'react';
import { usePopoverAlign } from '../../hooks/usePopoverAlign';
import { cx } from '../../utils/cx';
import { Button, type ButtonVariant } from '../core/Button';

export interface PopoverProps {
  /** Text of the trigger button; also the accessible name of the panel. */
  label: string;
  /** Panel content. `close` closes it and returns focus to the trigger. */
  children: (close: () => void) => ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Shows the trigger as busy (an action started from the panel is still running). */
  loading?: boolean;
  /** `menu` for a list of actions (the content must then be `menuitem`s), `group` for any other content. */
  panelRole?: 'group' | 'menu';
  /** Custom trigger content (e.g. avatar + name); `label` then stays the accessible name. */
  trigger?: ReactNode;
  /** Class of a custom trigger (replaces the button look). */
  triggerClassName?: string;
  /** Extra class of the floating panel (e.g. a wider panel with its own padding). */
  panelClassName?: string;
}

/** Button + floating panel. Closes on Escape and when focus leaves; stays inside the viewport. */
export function Popover({
  label,
  children,
  variant = 'secondary',
  disabled,
  loading,
  panelRole = 'group',
  trigger,
  triggerClassName,
  panelClassName,
}: PopoverProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const panelRef = usePopoverAlign(open);
  const triggerId = useId();
  const close = () => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  };
  return (
    <div
      role="presentation"
      className="app-popover"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      {trigger ? (
        <button
          type="button"
          id={triggerId}
          className={triggerClassName}
          disabled={disabled}
          aria-label={label}
          aria-haspopup={panelRole === 'menu' ? 'menu' : undefined}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {trigger}
        </button>
      ) : (
        <Button
          id={triggerId}
          variant={variant}
          size="sm"
          disabled={disabled}
          loading={loading}
          aria-haspopup={panelRole === 'menu' ? 'menu' : undefined}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </Button>
      )}
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role={panelRole}
          aria-label={label}
          className={cx('app-popover__panel', panelClassName)}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
