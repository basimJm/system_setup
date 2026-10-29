import { useId, type ReactNode } from 'react';
import { cx } from '../../utils/cx';

/** What a control must spread to be labelled, described and flagged by its `Field`. */
export interface FieldControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

export interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string | undefined;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label + control + hint/error wiring shared by every form-kit field. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx('app-field', error && 'app-field--error', className)}>
      <label className="app-field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': messageId })}
      {error ? (
        <span id={`${id}-error`} className="app-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="app-field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
