import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_REASON_LENGTH } from '@/constants/ui';
import { Button } from '../core/Button';
import { TextArea } from '../form/TextArea';
import { Modal } from './Modal';

export interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: string;
  destructive?: boolean;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Every impactful admin action needs a reason (Admin PRD §3, ABRL-03). */
export function ReasonDialog({
  open,
  title,
  description,
  destructive = false,
  confirmLabel,
  loading = false,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const invalid = trimmed.length < MIN_REASON_LENGTH;

  const close = () => {
    setReason('');
    setTouched(false);
    onClose();
  };
  const submit = () => {
    setTouched(true);
    if (!invalid) onConfirm(trimmed);
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} loading={loading} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="app-modal__text">{description}</p> : null}
      <TextArea
        label={t('reason.label')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={touched && invalid ? t('reason.required', { min: MIN_REASON_LENGTH }) : undefined}
        rows={4}
      />
    </Modal>
  );
}
