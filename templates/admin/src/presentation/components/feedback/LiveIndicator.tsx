import { useTranslation } from 'react-i18next';
import { useRealtimeStatus } from '../../hooks/useRealtime';
import { cx } from '../../utils/cx';

/** "Live" dot in the top bar: green when connected, amber while reconnecting, grey when updates are unavailable. */
export function LiveIndicator() {
  const { t } = useTranslation();
  const status = useRealtimeStatus();
  if (status === 'idle') return null;
  return (
    <span
      className={cx('app-live', `app-live--${status}`)}
      role="status"
      aria-label={t('realtime.label')}
    >
      <span className="app-live__dot" aria-hidden="true" />
      {t(`realtime.${status}`)}
    </span>
  );
}
