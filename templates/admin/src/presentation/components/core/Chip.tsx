import type { ReactNode } from 'react';
import type { ToneName } from '@/design/tokens/colors';
import { cx } from '../../utils/cx';
import { Icon } from './Icon';

export interface ChipProps {
  children: ReactNode;
  tone?: ToneName;
  /** When set, shows a remove button (used for active filters). */
  onRemove?: () => void;
  /** Accessible name of the remove button (a translated "Remove {{label}}"). */
  removeLabel?: string;
}

export function Chip({ children, tone = 'grey', onRemove, removeLabel }: ChipProps) {
  return (
    <span className={cx('app-chip', `app-chip--${tone}`)}>
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          className="app-chip__remove"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <Icon name="close" size="sm" />
        </button>
      ) : null}
    </span>
  );
}
