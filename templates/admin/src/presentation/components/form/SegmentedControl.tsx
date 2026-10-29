import type { KeyboardEvent } from 'react';
import type { IconName } from '@/constants/icons';
import { cx } from '../../utils/cx';
import { Icon } from '../core/Icon';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Hide the text and keep it as the accessible name (tight spaces). */
  iconOnly?: boolean;
}

/** Single-choice switch (language, theme). Radio-group semantics with arrow-key navigation. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  iconOnly = false,
}: SegmentedControlProps<T>) {
  const move = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    // In RTL the visual direction is mirrored, so arrows follow the document direction.
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const delta = rtl ? -step : step;
    const next = options[(index + delta + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="app-segmented">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            tabIndex={selected ? 0 : -1}
            className={cx('app-segmented__item', selected && 'app-segmented__item--on')}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => move(e, index)}
          >
            {option.icon ? <Icon name={option.icon} size="sm" /> : null}
            {iconOnly ? null : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
