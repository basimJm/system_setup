import { useTranslation } from 'react-i18next';
import { addDays, isLocalDate } from '@/domain/shared/time';
import { VALIDATION_KEYS } from '@/domain/shared/validation';
import { DateField } from './DateField';

export interface Schedule {
  /** `YYYY-MM-DD` or `""`. */
  readonly start: string;
  readonly end: string;
}

export interface SchedulePickerProps {
  startLabel: string;
  endLabel: string;
  value: Schedule;
  onChange: (value: Schedule) => void;
  /** Errors from the form (e.g. "required"); the "end must be after start" error is added here. */
  startError?: string | undefined;
  endError?: string | undefined;
}

/** Start and end day of a banner, a placement or a subscription period. The end must be after the start (PRD §3). */
export function SchedulePicker({
  startLabel,
  endLabel,
  value,
  onChange,
  startError,
  endError,
}: SchedulePickerProps) {
  const { t } = useTranslation();
  const bothSet = isLocalDate(value.start) && isLocalDate(value.end);
  const orderError =
    bothSet && value.end <= value.start ? t(VALIDATION_KEYS.endBeforeStart) : undefined;
  return (
    <div className="app-daterange__custom">
      <DateField
        label={startLabel}
        value={value.start}
        {...(isLocalDate(value.end) ? { max: addDays(value.end, -1) } : {})}
        error={startError}
        onValueChange={(start) => onChange({ ...value, start })}
      />
      <DateField
        label={endLabel}
        value={value.end}
        {...(isLocalDate(value.start) ? { min: addDays(value.start, 1) } : {})}
        error={endError ?? orderError}
        onValueChange={(end) => onChange({ ...value, end })}
      />
    </div>
  );
}
