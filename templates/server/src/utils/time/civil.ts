import {
  DAYS_OF_WEEK,
  EPOCH_DAY_OF_WEEK_INDEX,
  LOCAL_DATE_PATTERN,
  MAX_LOCAL_YEAR,
  MIN_LOCAL_YEAR,
  MS_PER_DAY,
  PART_DIGITS,
  YEAR_DIGITS,
  type DayOfWeek,
} from '../../constants/time';
import { ValidationError } from '../errors';
import { padNumber } from './pad';

/**
 * Calendar dates (`YYYY-MM-DD`) are plain labels: they say nothing about a zone, so the arithmetic
 * here runs on UTC midnights and can never be shifted by a daylight-saving change.
 */
export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const toEpochDay = ({ year, month, day }: CivilDate): number =>
  Date.UTC(year, month - 1, day) / MS_PER_DAY;

const fromEpochDay = (epochDay: number): CivilDate => {
  const date = new Date(epochDay * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

const FIRST_EPOCH_DAY = toEpochDay({ year: MIN_LOCAL_YEAR, month: 1, day: 1 });
const LAST_EPOCH_DAY = toEpochDay({ year: MAX_LOCAL_YEAR + 1, month: 1, day: 1 }) - 1;

/** The date, or `undefined` when the text is not a real calendar date in the supported years. */
const toCivil = (text: unknown): CivilDate | undefined => {
  if (typeof text !== 'string') return undefined;
  const match = LOCAL_DATE_PATTERN.exec(text);
  if (match === null) return undefined;
  const [, year = '', month = '', day = ''] = match;
  const civil = { year: Number(year), month: Number(month), day: Number(day) };
  const epochDay = toEpochDay(civil);
  if (epochDay < FIRST_EPOCH_DAY || epochDay > LAST_EPOCH_DAY) return undefined;
  // Date.UTC rolls 2026-02-30 over to March 2nd, so only a date that survives the round trip is real.
  const back = fromEpochDay(epochDay);
  const real = back.year === civil.year && back.month === civil.month && back.day === civil.day;
  return real ? civil : undefined;
};

export const formatLocalDate = ({ year, month, day }: CivilDate): string =>
  `${padNumber(year, YEAR_DIGITS)}-${padNumber(month, PART_DIGITS)}-${padNumber(day, PART_DIGITS)}`;

/** Is `value` a real `YYYY-MM-DD` date? Use it in request schemas. */
export const isLocalDate = (value: unknown): value is string => toCivil(value) !== undefined;

/** `"2026-10-12"` → its parts. Invalid input is a client error (400). */
export const parseLocalDate = (text: string): CivilDate => {
  const civil = toCivil(text);
  if (civil === undefined) throw new ValidationError();
  return civil;
};

/** The date `days` after `date` (negative goes back). */
export const addDays = (date: string, days: number): string => {
  const epochDay = toEpochDay(parseLocalDate(date));
  if (!Number.isSafeInteger(days)) throw new TypeError('days must be a whole number');
  const target = epochDay + days;
  if (target < FIRST_EPOCH_DAY || target > LAST_EPOCH_DAY) {
    throw new RangeError('the resulting date is outside the supported years');
  }
  return formatLocalDate(fromEpochDay(target));
};

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const diffDays = (from: string, to: string): number =>
  toEpochDay(parseLocalDate(to)) - toEpochDay(parseLocalDate(from));

/** Weekday of a calendar date, as the domain `DayOfWeek` value. */
export const dayOfWeek = (date: string): DayOfWeek => {
  const index = (toEpochDay(parseLocalDate(date)) + EPOCH_DAY_OF_WEEK_INDEX) % DAYS_OF_WEEK.length;
  const day = DAYS_OF_WEEK[index];
  if (day === undefined) throw new RangeError('weekday index out of range');
  return day;
};
