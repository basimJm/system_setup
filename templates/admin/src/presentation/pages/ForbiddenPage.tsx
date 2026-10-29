import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HTTP_CODES } from '@/constants/errors';
import { ROUTES } from '@/constants/routes';
import { StatusPage } from '../components/feedback/StatusPage';

export default function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <StatusPage
      code={String(HTTP_CODES.forbidden)}
      title={t('forbidden.title')}
      text={t('forbidden.text')}
      icon="shield"
      action={
        <Link className="app-link" to={ROUTES.root}>
          {t('forbidden.home')}
        </Link>
      }
    />
  );
}
