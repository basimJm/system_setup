import {
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_DAY,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  TIME_PARTS_LOCALE,
} from '../../constants/time';
import { addDays, formatLocalDate, parseLocalDate } from './civil';
import { assertInstant } from './instant';
import type { TimeRange } from './range';

// Zone names come from settings/config, never from clients, so this cache stays small (one entry
// per zone in use). Building a DateTimeFormat is slow, reading with a cached one is cheap.
const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatters.get(timeZone);
  if (cached !== undefined) return cached;
  // Intl silently falls back to the server's own zone for undefined, which must never happen.
  if (typeof timeZone !== 'string' || timeZone === '') {
    throw new RangeError('time zone must be a non-empty string');
  }
  let created: Intl.DateTimeFormat;
  try {
    created = new Intl.DateTimeFormat(TIME_PARTS_LOCALE, {
      timeZone,
      // h23 prints midnight as 00, whereas some engines print 24 with `hour12: false`.
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (error) {
    throw new RangeError(`invalid time zone: ${timeZone}`, { cause: error });
  }
  formatters.set(timeZone, created);
  return created;
};

/** Is `value` a time zone name the runtime knows (an IANA name such as `Etc/GMT-3`)? */
export const isValidTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string' || value === '') return false;
  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
};

interface WallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** What a wall clock in `timeZone` shows at `instant`. */
const wallClockAt = (instant: Date, timeZone: string): WallClock => {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = Number(parts.find((part) => part.type === type)?.value);
    if (!Number.isInteger(value)) throw new RangeError(`cannot read the ${type} in ${timeZone}`);
    return value;
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
};

/** The wall-clock reading written as if it were UTC, in ms: a zone-free number to compare and add. */
const wallClockAsUtcMs = (instant: Date, timeZone: string): number => {
  const { year, month, day, hour, minute, second } = wallClockAt(instant, timeZone);
  return Date.UTC(year, month - 1, day, hour, minute, second);
};

/** Minutes the zone is ahead of UTC at `instant` (Etc/GMT-3: 180). Varies with daylight saving. */
export const utcOffsetMinutes = (instant: Date, timeZone: string): number => {
  assertInstant(instant);
  // The wall clock has no milliseconds, so compare against the instant cut to whole seconds.
  const wholeSeconds = Math.floor(instant.getTime() / MS_PER_SECOND) * MS_PER_SECOND;
  return Math.round((wallClockAsUtcMs(instant, timeZone) - wholeSeconds) / MS_PER_MINUTE);
};

/** The business date (`YYYY-MM-DD`) in `timeZone` at `instant`. */
export const localDateOf = (instant: Date, timeZone: string): string => {
  assertInstant(instant);
  const { year, month, day } = wallClockAt(instant, timeZone);
  return formatLocalDate({ year, month, day });
};

/** Minutes since local midnight in `timeZone` at `instant` (0–1439). */
export const localMinutesOf = (instant: Date, timeZone: string): number => {
  assertInstant(instant);
  const { hour, minute } = wallClockAt(instant, timeZone);
  return hour * MINUTES_PER_HOUR + minute;
};

/**
 * The instant at which a wall clock in `timeZone` shows `minutes` on `date`.
 * Daylight saving can make a wall time ambiguous or missing:
 * - shown twice (clocks went back): the first time it happens;
 * - never shown (clocks jumped forward): pushed forward by the length of the gap.
 */
export const zonedTimeToUtc = (date: string, minutes: number, timeZone: string): Date => {
  const { year, month, day } = parseLocalDate(date);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
    throw new RangeError(`minutes must be a whole number from 0 to ${String(MINUTES_PER_DAY - 1)}`);
  }
  const wall = Date.UTC(year, month - 1, day) + minutes * MS_PER_MINUTE;
  // The offsets a day before and after bracket any daylight-saving change around the wall time.
  const before = utcOffsetMinutes(new Date(wall - MS_PER_DAY), timeZone);
  const after = utcOffsetMinutes(new Date(wall + MS_PER_DAY), timeZone);
  const matching = [...new Set([before, after])]
    .map((offset) => wall - offset * MS_PER_MINUTE)
    .filter((candidate) => wallClockAsUtcMs(new Date(candidate), timeZone) === wall);
  if (matching.length > 0) return new Date(Math.min(...matching));
  return new Date(wall - before * MS_PER_MINUTE);
};

/**
 * The span of one business day, `[local midnight, next local midnight)`. It is 24 hours long
 * except on daylight-saving days (23 or 25 hours; 23.5 or 24.5 in Lord Howe).
 */
export const localDayRange = (date: string, timeZone: string): TimeRange => ({
  start: zonedTimeToUtc(date, 0, timeZone),
  end: zonedTimeToUtc(addDays(date, 1), 0, timeZone),
});
