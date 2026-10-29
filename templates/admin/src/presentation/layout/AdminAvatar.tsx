import { cx } from '../utils/cx';

/** The signed-in admin's initial on the brand gradient (design: sidebar footer and top-bar menu). */
export function AdminAvatar({ name, small = false }: { name: string; small?: boolean }) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '';
  return (
    <span className={cx('app-admin-avatar', small && 'app-admin-avatar--sm')} aria-hidden="true">
      {initial}
    </span>
  );
}
