import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDialogBehavior } from '../../hooks/useDialogBehavior';
import { IconButton } from '../core/IconButton';

export interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Side panel for detail views and edits next to a list. Slides in from the end edge (the left in Arabic). */
export function Drawer({ open, title, onClose, children, footer }: DrawerProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useDialogBehavior(open, panel, onClose);
  if (!open) return null;
  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- backdrop click is a pointer shortcut; Esc and the close button are the accessible paths
    <div
      className="app-overlay app-overlay--drawer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className="app-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="app-modal__header">
          <h2 id={titleId} className="app-modal__title">
            {title}
          </h2>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} />
        </header>
        <div className="app-modal__body app-drawer__body">{children}</div>
        {footer ? <footer className="app-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
