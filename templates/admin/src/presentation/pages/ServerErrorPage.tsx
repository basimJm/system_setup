import { useTranslation } from 'react-i18next';
import { HTTP_CODES } from '@/constants/errors';
import { Button } from '../components/core/Button';
import { StatusPage } from '../components/feedback/StatusPage';

export default function ServerErrorPage() {
  const { t } = useTranslation();
  return (
    <StatusPage
      code={String(HTTP_CODES.serverError)}
      title={t('serverError.title')}
      text={t('serverError.text')}
      action={<Button onClick={() => window.location.reload()}>{t('serverError.retry')}</Button>}
    />
  );
}
