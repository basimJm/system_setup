import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';
import { formatInstant } from '@/domain/shared/format';
import { Button } from '../core/Button';

export interface LastUpdated {
  by: string;
  /** ISO instant (UTC). */
  at: string;
}

export interface FormActionsProps {
  /** Nothing changed yet: Save and Cancel stay disabled. */
  dirty: boolean;
  submitting?: boolean;
  onCancel?: () => void;
  lastUpdated?: LastUpdated | undefined;
  saveLabel?: string;
}

/** Save bar at the bottom of an edit form, with the "last updated by/at" line (Admin PRD §2). */
export function FormActions({
  dirty,
  submitting = false,
  onCancel,
  lastUpdated,
  saveLabel,
}: FormActionsProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <div className="app-form-actions">
      {lastUpdated ? (
        <span className="app-form-actions__meta">
          {t('form.lastUpdated', {
            name: lastUpdated.by,
            time: formatInstant(lastUpdated.at, language),
          })}
        </span>
      ) : null}
      <div className="app-row app-form-actions__buttons">
        {onCancel ? (
          <Button variant="secondary" disabled={!dirty || submitting} onClick={onCancel}>
            {t('form.cancel')}
          </Button>
        ) : null}
        <Button type="submit" disabled={!dirty} loading={submitting}>
          {saveLabel ?? t('form.save')}
        </Button>
      </div>
    </div>
  );
}
