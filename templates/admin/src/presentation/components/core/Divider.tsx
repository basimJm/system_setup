import { cx } from '../../utils/cx';

export function Divider({
  vertical = false,
  className,
}: {
  vertical?: boolean;
  className?: string;
}) {
  return (
    <hr
      className={cx('app-divider', vertical && 'app-divider--vertical', className)}
      aria-orientation={vertical ? 'vertical' : undefined}
    />
  );
}
