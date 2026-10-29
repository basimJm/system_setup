import { cx } from '../../utils/cx';

export interface SkeletonProps {
  height?: 'md' | 'lg';
  /** Width as a fraction of the container: 1 = full. */
  width?: 'full' | 'half' | 'third';
}

export function Skeleton({ height = 'md', width = 'full' }: SkeletonProps) {
  return (
    <span
      className={cx('app-skeleton', `app-skeleton--${height}`, `app-skeleton--${width}`)}
      aria-hidden="true"
    />
  );
}
