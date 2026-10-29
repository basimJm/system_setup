import type { FocusEventHandler } from 'react';
import { isLocalDate } from '@/domain/shared/time';
import { Field } from './Field';

export interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD` or `""`. */
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  error?: string | undefined;
  hint?: string | undefined;
  name?: string;
  disabled?: boolean;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

/** Calendar-day input (no time zone): emits only real `YYYY-MM-DD` days or an empty string. */
export function DateField({
  label,
  value,
  onValueChange,
  min,
  max,
  error,
  hint,
  name,
  disabled,
  onBlur,
}: DateFieldProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <input
          {...control}
          className="app-field__control"
          type="date"
          name={name}
          disabled={disabled}
          min={min}
          max={max}
          value={value}
          onBlur={onBlur}
          onChange={(event) => {
            const next = event.target.value;
            onValueChange(next === '' || isLocalDate(next) ? next : '');
          }}
        />
      )}
    </Field>
  );
}
