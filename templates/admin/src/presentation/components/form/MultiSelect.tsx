import type { FocusEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { useCombobox } from '../../hooks/useCombobox';
import type { Option } from '../../utils/filterOptions';
import { Chip } from '../core/Chip';
import { Field } from './Field';
import { OptionList } from './OptionList';

export interface MultiSelectProps {
  label: string;
  options: readonly Option[];
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  error?: string | undefined;
  hint?: string | undefined;
  disabled?: boolean;
  onBlur?: FocusEventHandler<HTMLElement>;
}

/** Searchable multi select; chosen options are removable chips, the list stays open while picking. */
export function MultiSelect({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  error,
  hint,
  disabled,
  onBlur,
}: MultiSelectProps) {
  const { t } = useTranslation();
  const toggle = (optionValue: string) =>
    onValueChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  const box = useCombobox({
    options,
    keepOpen: true,
    onPick: (option) => toggle(option.value),
    onBackspaceEmpty: () => {
      const last = value[value.length - 1];
      if (last !== undefined) toggle(last);
    },
  });
  const chosen = value.flatMap((v) => options.filter((o) => o.value === v));
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
          {chosen.length > 0 ? (
            <div className="app-row app-multi__chips">
              {chosen.map((o) => (
                <Chip
                  key={o.value}
                  tone="purple"
                  onRemove={() => toggle(o.value)}
                  removeLabel={t('form.removeOption', { label: o.label })}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          ) : null}
          <input
            {...control}
            className="app-field__control"
            role="combobox"
            disabled={disabled}
            autoComplete="off"
            aria-expanded={box.open}
            aria-controls={box.listId}
            aria-autocomplete="list"
            aria-activedescendant={
              box.open && box.filtered.length > 0 ? box.optionId(box.activeIndex) : undefined
            }
            placeholder={placeholder}
            value={box.query}
            onFocus={() => box.setOpen(true)}
            onChange={(event) => box.setQuery(event.target.value)}
            onKeyDown={box.onKeyDown}
          />
          {box.open ? (
            <OptionList
              multiple
              listId={box.listId}
              optionId={box.optionId}
              options={box.filtered}
              activeIndex={box.activeIndex}
              isSelected={(v) => value.includes(v)}
              onPick={box.pick}
            />
          ) : null}
        </div>
      )}
    </Field>
  );
}
