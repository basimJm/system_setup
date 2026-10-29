import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/domain/shared/numbers';
import { useLanguage } from '../../hooks/useLanguage';
import { Button } from '../core/Button';
import { Modal } from '../overlay/Modal';

export interface IdleWarningDialogProps {
  open: boolean;
  secondsLeft: number;
  onStay: () => void;
  onSignOut: () => void;
}

/** "Your session is about to end": keep working, or sign out now. The only way to extend the session. */
export function IdleWarningDialog({
  open,
  secondsLeft,
  onStay,
  onSignOut,
}: IdleWarningDialogProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <Modal
      open={open}
      title={t('session.idleTitle')}
      onClose={onStay}
      footer={
        <>
          <Button variant="ghost" onClick={onSignOut}>
            {t('topbar.logout')}
          </Button>
          <Button onClick={onStay}>{t('session.stay')}</Button>
        </>
      }
    >
      <p className="app-modal__text" role="status">
        {t('session.idleText', { seconds: formatNumber(secondsLeft, language) })}
      </p>
    </Modal>
  );
}
