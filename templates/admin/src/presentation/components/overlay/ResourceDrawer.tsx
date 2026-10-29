import type { ReactNode, SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_REASON_LENGTH } from '@/constants/ui';
import { Button } from '../core/Button';
import { InlineAlert } from '../feedback/InlineAlert';
import { Select } from '../form/Select';
import { TextField } from '../form/TextField';
import { Drawer } from './Drawer';

/** Reason rule shared by every audited form: the i18n key of the error, or nothing. */
export const reasonError = (reason: string): string | undefined =>
  reason.trim().length < MIN_REASON_LENGTH ? 'reason.required' : undefined;

export interface ResourceDrawerProps {
  title: string;
  children: ReactNode;
  reason: string;
  reasonErr: string | undefined;
  /** Overrides the field's name and hint when it holds a note instead of an audit reason. */
  reasonLabel?: string;
  reasonHint?: string;
  onReason: (value: string) => void;
  saving: boolean;
  error: unknown;
  onSubmit: () => void;
  onClose: () => void;
}

/** Side panel shell: the form fields, the mandatory reason, the save error and the buttons. */
export function ResourceDrawer(p: ResourceDrawerProps) {
  const { t } = useTranslation();
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    p.onSubmit();
  };
  return (
    <Drawer open title={p.title} onClose={p.onClose}>
      <form className="app-drawer-form" onSubmit={submit} noValidate>
        {p.children}
        <TextField
          label={p.reasonLabel ?? t('reason.label')}
          hint={p.reasonHint ?? t('reason.hint')}
          value={p.reason}
          error={p.reasonErr ? t(p.reasonErr, { min: MIN_REASON_LENGTH }) : undefined}
          onChange={(e) => p.onReason(e.target.value)}
        />
        {p.error ? <InlineAlert error={p.error} /> : null}
        <div className="app-row app-drawer-form__actions">
          <Button variant="secondary" onClick={p.onClose} disabled={p.saving}>
            {t('form.cancel')}
          </Button>
          <Button type="submit" loading={p.saving}>
            {t('form.save')}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

export { Select };
