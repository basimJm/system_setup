import { useId, type SelectHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: readonly SelectOption[];
  error?: string | undefined;
}

export function Select({ label, options, error, className, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={cx('app-field', error && 'app-field--error', className)}>
      <label className="app-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="app-field__control"
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="app-field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
