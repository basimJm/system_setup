import { useId, type InputHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string;
  /** `switch` for on/off settings, `checkbox` for selections. */
  kind?: 'switch' | 'checkbox';
}

export function Toggle({ label, kind = 'checkbox', className, ...rest }: ToggleProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('app-toggle', `app-toggle--${kind}`, className)}>
      <input id={id} type="checkbox" role={kind === 'switch' ? 'switch' : undefined} {...rest} />
      <span className="app-toggle__mark" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
