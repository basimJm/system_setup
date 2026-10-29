import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/domain/shared/format';
import { useLanguage } from '../../hooks/useLanguage';
import { Button } from '../core/Button';

export interface TableToolbarProps {
  /** Number of selected rows; the bulk bar shows only when it is above zero. */
  selectedCount?: number;
  onClearSelection?: () => void;
  /** Buttons that act on the selection (approve, block...). */
  bulkActions?: ReactNode;
  /** Right side: column picker, density toggle, export button. */
  tools?: ReactNode;
  onExport?: () => void;
}

/** Row above a table: the bulk-action bar while rows are selected, the view tools always. */
export function TableToolbar({
  selectedCount = 0,
  onClearSelection,
  bulkActions,
  tools,
  onExport,
}: TableToolbarProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <div className="app-table-toolbar">
      {selectedCount > 0 ? (
        <div className="app-row app-table-toolbar__bulk" role="status">
          <span>{t('table.selected', { count: formatNumber(selectedCount, language) })}</span>
          {bulkActions}
          {onClearSelection ? (
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              {t('table.clearSelection')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="app-row app-table-toolbar__tools">
        {tools}
        {onExport ? (
          <Button variant="secondary" size="sm" onClick={onExport}>
            {t('table.export')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
