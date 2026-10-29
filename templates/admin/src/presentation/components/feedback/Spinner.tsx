import { useTranslation } from 'react-i18next';
import { cx } from '../../utils/cx';

export function Spinner({ small = false }: { small?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cx('app-spinner', small && 'app-spinner--sm')}
      role="status"
      aria-label={t('common.loading')}
    />
  );
}
