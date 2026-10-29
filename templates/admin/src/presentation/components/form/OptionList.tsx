import { useTranslation } from 'react-i18next';
import { cx } from '../../utils/cx';
import type { Option } from '../../utils/filterOptions';

export interface OptionListProps {
  listId: string;
  optionId: (index: number) => string;
  options: readonly Option[];
  activeIndex: number;
  isSelected: (value: string) => boolean;
  onPick: (option: Option) => void;
  multiple?: boolean;
}

/** The popup of Combobox / MultiSelect. Mouse-down is prevented so the input keeps focus while picking. */
export function OptionList({
  listId,
  optionId,
  options,
  activeIndex,
  isSelected,
  onPick,
  multiple = false,
}: OptionListProps) {
  const { t } = useTranslation();
  return (
    <ul
      id={listId}
      className="app-options"
      role="listbox"
      aria-multiselectable={multiple || undefined}
    >
      {options.length === 0 ? (
        <li className="app-options__empty" role="presentation">
          {t('form.noOptions')}
        </li>
      ) : (
        options.map((option, index) => (
          // Keyboard users pick through the combobox input (aria-activedescendant); the list is never focused.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={isSelected(option.value)}
            className={cx(
              'app-options__item',
              index === activeIndex && 'app-options__item--active',
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(option)}
          >
            {option.label}
          </li>
        ))
      )}
    </ul>
  );
}
