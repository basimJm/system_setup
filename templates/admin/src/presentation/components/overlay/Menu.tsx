import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../../utils/cx';
import type { ButtonVariant } from '../core/Button';
import { Popover } from './Popover';

export interface MenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  /** Red text for actions that cannot be undone. */
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** Text of the button that opens the menu. */
  label: string;
  items: readonly MenuItem[];
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Custom trigger content and class (see Popover). */
  trigger?: ReactNode;
  triggerClassName?: string;
  /** Non-interactive content above the items (e.g. who is signed in). */
  header?: ReactNode;
}

const ITEM = '[role="menuitem"]:not([disabled])';

function MenuItems({
  items,
  close,
  header,
}: {
  items: readonly MenuItem[];
  close: () => void;
  header?: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(ITEM)?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent) => {
    const nodes = [...(list.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])];
    const index = nodes.findIndex((node) => node === document.activeElement);
    const target =
      event.key === 'ArrowDown'
        ? nodes[(index + 1) % nodes.length]
        : event.key === 'ArrowUp'
          ? nodes[(index - 1 + nodes.length) % nodes.length]
          : event.key === 'Home'
            ? nodes[0]
            : event.key === 'End'
              ? nodes[nodes.length - 1]
              : undefined;
    if (!target) return;
    event.preventDefault();
    target.focus();
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- arrow-key navigation of the menu items inside
    <div ref={list} className="app-menu" onKeyDown={onKeyDown}>
      {header ? <div className="app-menu__header">{header}</div> : null}
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={cx('app-menu__item', item.danger && 'app-menu__item--danger')}
          onClick={() => {
            close();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Actions menu (row actions, "more"). Arrow keys, Home/End move; Enter selects; Escape closes. */
export function Menu({
  label,
  items,
  variant,
  disabled,
  trigger,
  triggerClassName,
  header,
}: MenuProps) {
  return (
    <Popover
      label={label}
      panelRole="menu"
      {...(variant ? { variant } : {})}
      {...(trigger ? { trigger } : {})}
      {...(triggerClassName ? { triggerClassName } : {})}
      disabled={disabled}
    >
      {(close) => <MenuItems items={items} close={close} header={header} />}
    </Popover>
  );
}
