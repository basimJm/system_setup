import type { FocusEventHandler } from 'react';
import { useCombobox } from '../../hooks/useCombobox';
import type { Option } from '../../utils/filterOptions';
import { Field } from './Field';
import { OptionList } from './OptionList';

export interface ComboboxProps {
  label: string;
  options: readonly Option[];
  /** Selected option value, `null` = nothing. */
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  error?: string | undefined;
  hint?: string | undefined;
  name?: string;
  disabled?: boolean;
  onBlur?: FocusEventHandler<HTMLElement>;
}

/** Searchable single select (type to filter, arrows + Enter to pick, Esc to close). */
export function Combobox({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  error,
  hint,
  name,
  disabled,
  onBlur,
}: ComboboxProps) {
  const box = useCombobox({ options, onPick: (option) => onValueChange(option.value) });
  const selected = options.find((o) => o.value === value);
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <div
          className="app-combobox"
          onBlur={(event) => {
            box.onBlur(event);
            onBlur?.(event);
          }}
        >
          <input
            {...control}
            className="app-field__control"
            role="combobox"
            name={name}
            disabled={disabled}
            autoComplete="off"
            aria-expanded={box.open}
            aria-controls={box.listId}
            aria-autocomplete="list"
            aria-activedescendant={
              box.open && box.filtered.length > 0 ? box.optionId(box.activeIndex) : undefined
            }
            placeholder={placeholder}
            value={box.open ? box.query : (selected?.label ?? '')}
            onFocus={() => box.setOpen(true)}
            onChange={(event) => box.setQuery(event.target.value)}
            onKeyDown={box.onKeyDown}
          />
          {box.open ? (
            <OptionList
              listId={box.listId}
              optionId={box.optionId}
              options={box.filtered}
              activeIndex={box.activeIndex}
              isSelected={(v) => v === value}
              onPick={box.pick}
            />
          ) : null}
        </div>
      )}
    </Field>
  );
}
