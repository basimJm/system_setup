import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HTTP_CODES } from '@/constants/errors';
import { ROUTES } from '@/constants/routes';
import { StatusPage } from '../components/feedback/StatusPage';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <StatusPage
      code={String(HTTP_CODES.notFound)}
      title={t('notFound.title')}
      text={t('notFound.text')}
      action={
        <Link className="app-link" to={ROUTES.root}>
          {t('notFound.home')}
        </Link>
      }
    />
  );
}
