import { useTranslation } from 'react-i18next';
import { settingId } from '@/domain/settings/registry';
import { settingToText } from '@/domain/settings/validate';
import { Badge } from '../components/core/Badge';
import { Button } from '../components/core/Button';
import { TextField } from '../components/form/TextField';
import type { SettingRow } from './useSettingsDraft';

export interface SettingRowFieldProps {
  row: SettingRow;
  onText: (id: string, text: string) => void;
  onUseDefault: (id: string) => void;
}

/** One setting: label with unit, the value box, its default, whether it is overridden, and "use default". */
export function SettingRowField({ row, onText, onUseDefault }: SettingRowFieldProps) {
  const { t } = useTranslation();
  const { def } = row;
  const id = settingId(row.id);
  const unit = def.unit ? ` (${t(`settings.unit.${def.unit}`)})` : '';
  return (
    <div className="app-setting">
      <TextField
        label={`${t(`settings.key.${id}`)}${unit}`}
        value={row.text}
        inputMode={def.kind === 'int' ? 'numeric' : 'text'}
        dir="ltr"
        onChange={(e) => onText(row.id, e.target.value)}
        error={
          row.error ? t(`settings.error.${row.error}`, { min: def.min, max: def.max }) : undefined
        }
        hint={t('settings.default', { value: settingToText(row.fallback) })}
      />
      <div className="app-row app-setting__meta">
        <Badge tone={row.canReset ? 'amber' : 'grey'}>
          {t(row.canReset ? 'settings.overridden' : 'settings.isDefault')}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          disabled={!row.canReset}
          onClick={() => onUseDefault(row.id)}
        >
          {t('settings.useDefault')}
        </Button>
      </div>
    </div>
  );
}
