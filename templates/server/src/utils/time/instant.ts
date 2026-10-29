import { MS_PER_MINUTE } from '../../constants/time';

export function assertInstant(value: unknown, name = 'instant'): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${name} must be a valid Date`);
  }
}

/** The instant `minutes` after `instant` (negative goes back). Plain UTC arithmetic. */
export const addMinutes = (instant: Date, minutes: number): Date => {
  assertInstant(instant);
  if (!Number.isSafeInteger(minutes)) throw new TypeError('minutes must be a whole number');
  return new Date(instant.getTime() + minutes * MS_PER_MINUTE);
};
