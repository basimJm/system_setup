import { useEffect, useRef } from 'react';

export interface SelectBoxProps {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}

/** Table checkbox: styled like `Toggle`, supports the mixed state of "select all". Stops row clicks. */
export function SelectBox({ label, checked, indeterminate = false, onChange }: SelectBoxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="app-toggle app-toggle--checkbox app-select-box">
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={onChange}
        onClick={(event) => event.stopPropagation()}
      />
      <span className="app-toggle__mark" aria-hidden="true" />
    </label>
  );
}
