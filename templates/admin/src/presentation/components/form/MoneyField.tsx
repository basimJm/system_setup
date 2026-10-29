import type { FocusEventHandler } from 'react';
import { MONEY_DECIMAL_PLACES } from '@/constants/kernel';
import { sanitizeDecimal } from '../../utils/numericInput';
import { Field } from './Field';

export interface MoneyFieldProps {
  label: string;
  /** money decimal string (`"12.500"`), `""` when empty. Never a float. */
  value: string;
  onValueChange: (value: string) => void;
  /** Currency name shown after the input (translated by the caller). */
  currencyLabel?: string;
  error?: string | undefined;
  hint?: string | undefined;
  name?: string;
  disabled?: boolean;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

/** Money input: edits a money string with at most 3 decimals; validation (positive, range) lives in the schema. */
export function MoneyField({
  label,
  value,
  onValueChange,
  currencyLabel,
  error,
  hint,
  name,
  disabled,
  onBlur,
}: MoneyFieldProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <div className="app-field__box">
          <input
            {...control}
            className="app-field__control app-field__control--with-end"
            name={name}
            disabled={disabled}
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            value={value}
            onBlur={onBlur}
            onChange={(event) =>
              onValueChange(
                sanitizeDecimal(event.target.value, { maxDecimals: MONEY_DECIMAL_PLACES }),
              )
            }
          />
          {currencyLabel ? (
            <span className="app-field__end app-field__unit">{currencyLabel}</span>
          ) : null}
        </div>
      )}
    </Field>
  );
}
