import { useId, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string | undefined;
}

export function TextArea({ label, error, className, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <div className={cx('app-field', error && 'app-field--error', className)}>
      <label className="app-field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="app-field__control app-field__control--area"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error ? (
        <span id={`${id}-error`} className="app-field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
