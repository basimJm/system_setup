import { useTranslation } from 'react-i18next';
import { normalizeError } from '@/infrastructure/errors/normalize';
import { Icon } from '../core/Icon';

/** Compact, localized error line for forms (login, dialogs). Full-page failures use ErrorState. */
export function InlineAlert({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const appError = normalizeError(error);
  return (
    <div className="app-alert" role="alert">
      <Icon name="alert" size="sm" />
      <span>{appError.serverMessage ?? t(appError.messageKey)}</span>
    </div>
  );
}
