import type { ButtonHTMLAttributes } from 'react';
import type { IconName } from '@/constants/icons';
import { cx } from '../../utils/cx';
import { Icon } from './Icon';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  icon: IconName;
  /** Required: an icon-only control must have an accessible name. */
  label: string;
  badge?: number;
  directional?: boolean;
}

export function IconButton({
  icon,
  label,
  badge,
  directional,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={badge !== undefined && badge > 0 ? `${label} ${String(badge)}` : label}
      title={label}
      className={cx('app-iconbtn', className)}
      {...rest}
    >
      <Icon name={icon} {...(directional ? { directional } : {})} />
      {badge !== undefined && badge > 0 ? (
        <span className="app-iconbtn__badge">{badge}</span>
      ) : null}
    </button>
  );
}
