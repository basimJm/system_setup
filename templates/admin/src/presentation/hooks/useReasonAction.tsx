import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReasonDialog } from '../components/overlay/ReasonDialog';

export interface ReasonAction {
  /** Opens the reason dialog; `run` gets the reason once the admin confirms. */
  ask: (run: (reason: string) => void) => void;
  dialog: ReactNode;
}

/** Every audited admin change asks for a reason first (PRD §3). */
export function useReasonAction(loading: boolean, destructive = false): ReasonAction {
  const { t } = useTranslation();
  const [run, setRun] = useState<((reason: string) => void) | null>(null);
  const dialog = (
    <ReasonDialog
      open={run !== null}
      title={t('reason.title')}
      description={t('reason.hint')}
      confirmLabel={t('reason.confirm')}
      destructive={destructive}
      loading={loading}
      onConfirm={(reason) => {
        run?.(reason);
        setRun(null);
      }}
      onClose={() => setRun(null)}
    />
  );
  // The function is wrapped: React would otherwise call it as a state updater.
  return { ask: (next) => setRun(() => next), dialog };
}
