import { useState, type FocusEventHandler } from 'react';
import { sanitizeDecimal } from '../../utils/numericInput';
import { Field } from './Field';

export interface NumberFieldProps {
  label: string;
  /** `null` = empty. */
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Digits allowed after the dot; 0 = whole numbers only. */
  decimals?: number;
  allowNegative?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
  name?: string;
  disabled?: boolean;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

const toNumber = (text: string): number | null => {
  if (text === '' || text === '-' || text === '.') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

/** Numeric text input: Arabic digits are accepted, junk is dropped, the value is a real number. */
export function NumberField({
  label,
  value,
  onValueChange,
  decimals = 0,
  allowNegative = false,
  error,
  hint,
  name,
  disabled,
  onBlur,
}: NumberFieldProps) {
  // What the user typed, kept only while it still means `value` (so "1." and "-" survive typing).
  const [draft, setDraft] = useState<string | null>(null);
  const text =
    draft !== null && toNumber(draft) === value ? draft : value === null ? '' : String(value);
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <input
          {...control}
          className="app-field__control"
          name={name}
          disabled={disabled}
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          dir="ltr"
          value={text}
          onBlur={onBlur}
          onChange={(event) => {
            const next = sanitizeDecimal(event.target.value, {
              maxDecimals: decimals,
              allowNegative,
            });
            setDraft(next);
            onValueChange(toNumber(next));
          }}
        />
      )}
    </Field>
  );
}
