import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DATE_PRESETS, type DatePreset } from '@/constants/dateRange';
import { VALIDATION_KEYS } from '@/domain/shared/validation';
import {
  isValidRange,
  previousPeriod,
  resolvePreset,
  type DateRange,
  type DateRangeValue,
} from '@/domain/shared/dateRange';
import { localizeDigits } from '@/domain/shared/format';
import { useLanguage } from '../../hooks/useLanguage';
import { DateField } from '../form/DateField';
import { Select } from '../form/Select';
import { Toggle } from '../form/Toggle';

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Offer the "compare with the previous period" switch. */
  allowCompare?: boolean;
  /** "Today" for presets; injectable so tests and previews are deterministic. */
  now?: Date;
}

/**
 * Presets (Today ... This year) plus a custom range, optionally compared with the previous period.
 * Days are Etc/GMT-3 calendar days. A custom range is only reported once it is valid (from <= to).
 */
export function DateRangePicker({
  value,
  onChange,
  allowCompare = true,
  now,
}: DateRangePickerProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [draft, setDraft] = useState<DateRange | null>(null);
  const shown = draft ?? value;
  const invalid = draft !== null && draft.from !== '' && draft.to !== '' && draft.from > draft.to;

  const pickPreset = (preset: DatePreset) => {
    setDraft(null);
    if (preset === 'custom') onChange({ ...value, preset });
    else onChange({ ...value, preset, ...resolvePreset(preset, now ?? new Date()) });
  };
  const editCustom = (next: DateRange) => {
    if (isValidRange(next)) {
      setDraft(null);
      onChange({ ...value, preset: 'custom', ...next });
    } else setDraft(next);
  };
  const previous = value.compare ? previousPeriod(value) : null;
  const fmt = (range: DateRange) =>
    `${localizeDigits(range.from, language)} – ${localizeDigits(range.to, language)}`;

  return (
    <div className="app-daterange">
      <Select
        label={t('dateRange.label')}
        value={value.preset}
        options={DATE_PRESETS.map((p) => ({ value: p, label: t(`dateRange.preset.${p}`) }))}
        onChange={(event) => pickPreset(event.target.value as DatePreset)}
      />
      {value.preset === 'custom' ? (
        <div className="app-daterange__custom">
          <DateField
            label={t('dateRange.from')}
            value={shown.from}
            max={shown.to || undefined}
            onValueChange={(from) => editCustom({ from, to: shown.to })}
          />
          <DateField
            label={t('dateRange.to')}
            value={shown.to}
            min={shown.from || undefined}
            error={invalid ? t(VALIDATION_KEYS.endBeforeStart) : undefined}
            onValueChange={(to) => editCustom({ from: shown.from, to })}
          />
        </div>
      ) : null}
      <p className="app-daterange__summary" aria-live="polite">
        {fmt(value)}
        {previous ? ` · ${t('dateRange.versus')} ${fmt(previous)}` : ''}
      </p>
      {allowCompare ? (
        <Toggle
          kind="switch"
          label={t('dateRange.compare')}
          checked={value.compare}
          onChange={(event) => onChange({ ...value, compare: event.target.checked })}
        />
      ) : null}
    </div>
  );
}
