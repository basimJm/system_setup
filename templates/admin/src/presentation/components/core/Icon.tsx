import { ICON_PATHS, ICON_STROKE_WIDTH, type IconName } from '@/constants/icons';
import { cx } from '../../utils/cx';

export interface IconProps {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';
  /** Decorative by default; pass a label when the icon is the only content. */
  label?: string;
  /** Mirror in RTL (arrows, chevrons that point along the reading direction). */
  directional?: boolean;
}

export function Icon({ name, size = 'md', label, directional = false }: IconProps) {
  return (
    <svg
      className={cx('app-icon', `app-icon--${size}`, directional && 'app-icon--directional')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
