import { useTranslation } from 'react-i18next';
import type { ColumnVisibility } from '../../hooks/useColumnVisibility';
import { Button } from '../core/Button';
import { Toggle } from '../form/Toggle';
import { Popover } from '../overlay/Popover';

export interface ColumnPickerProps {
  columns: readonly { key: string; header: string }[];
  visibility: ColumnVisibility;
}

/** "Columns" button with a checkbox list. The last visible column stays checked and disabled. */
export function ColumnPicker({ columns, visibility }: ColumnPickerProps) {
  const { t } = useTranslation();
  const shownCount = columns.filter((c) => !visibility.hidden.has(c.key)).length;
  return (
    <Popover label={t('table.columns')}>
      {() => (
        <>
          {columns.map((c) => {
            const isShown = !visibility.hidden.has(c.key);
            return (
              <Toggle
                key={c.key}
                label={c.header}
                checked={isShown}
                disabled={isShown && shownCount === 1}
                onChange={() => visibility.toggle(c.key)}
              />
            );
          })}
          <Button variant="ghost" size="sm" onClick={visibility.reset}>
            {t('table.resetColumns')}
          </Button>
        </>
      )}
    </Popover>
  );
}
