import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EXPORT_FORMATS, type ExportFormat } from '@/constants/dateRange';
import { Icon } from '../core/Icon';
import { Popover } from '../overlay/Popover';
import { useToast } from '../overlay/Toast';

export interface ExportMenuProps {
  /** Starts the export of the current filtered result and resolves when the file is ready. */
  onExport: (format: ExportFormat) => Promise<void>;
  formats?: readonly ExportFormat[];
  disabled?: boolean;
}

/**
 * Design list-card "Export" button (download icon + text) with a menu of file chips: Excel / CSV / PDF. Shows
 * progress and the outcome as toasts (Admin PRD §2).
 */
export function ExportMenu({ onExport, formats = EXPORT_FORMATS, disabled }: ExportMenuProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (format: ExportFormat) => {
    setBusy(true);
    toast.show(t('export.started', { format: t(`export.format.${format}`) }), 'info');
    try {
      await onExport(format);
      toast.show(t('export.done'), 'success');
    } catch {
      toast.show(t('export.failed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const label = t('export.label');
  return (
    <Popover
      label={label}
      disabled={disabled || busy}
      triggerClassName="app-cardbtn"
      trigger={
        <>
          <Icon name="download" size="sm" />
          <span>{label}</span>
        </>
      }
    >
      {(close) =>
        formats.map((format) => (
          <button
            key={format}
            type="button"
            className="app-menu__item app-export__item"
            onClick={() => {
              close();
              void run(format);
            }}
          >
            <span
              className={`app-export__chip app-export__chip--${format.toLowerCase()}`}
              aria-hidden="true"
            >
              {t(`export.chip.${format}`)}
            </span>
            <span>{t(`export.format.${format}`)}</span>
          </button>
        ))
      }
    </Popover>
  );
}
