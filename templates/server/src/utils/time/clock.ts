import {
  HH_MM_PATTERN,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  PART_DIGITS,
} from '../../constants/time';
import { ValidationError } from '../errors';
import { padNumber } from './pad';

/** Is `value` a valid 24-hour `HH:mm` string (`00:00`–`23:59`)? Use it in request schemas. */
export const isHHmm = (value: unknown): value is string =>
  typeof value === 'string' && HH_MM_PATTERN.test(value);

/** `"07:30"` → `450` minutes since local midnight. Invalid input is a client error (400). */
export const parseHHmm = (text: string): number => {
  const match = typeof text === 'string' ? HH_MM_PATTERN.exec(text) : null;
  if (match === null) throw new ValidationError();
  const [, hours = '', minutes = ''] = match;
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
};

/** `450` → `"07:30"`. Only minutes inside one day are valid. */
export const formatHHmm = (minutes: number): string => {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
    throw new RangeError(`minutes must be a whole number from 0 to ${String(MINUTES_PER_DAY - 1)}`);
  }
  const hours = padNumber(Math.floor(minutes / MINUTES_PER_HOUR), PART_DIGITS);
  return `${hours}:${padNumber(minutes % MINUTES_PER_HOUR, PART_DIGITS)}`;
};
