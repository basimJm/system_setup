import {
  BUSINESS_TIME_ZONE,
  ISO_INSTANT_PATTERN,
  LOCAL_DATE_PATTERN,
  MINUTES_PER_DAY,
  MS_PER_MINUTE,
} from '../../constants/kernel';

/** An instant is stored and exchanged in UTC (ISO 8601); the business zone is applied only for display and day logic. */
export type Instant = Date;

export const isInstantString = (text: unknown): text is string =>
  typeof text === 'string' && ISO_INSTANT_PATTERN.test(text) && !Number.isNaN(Date.parse(text));

export function parseInstant(text: string): Instant {
  if (!isInstantString(text)) throw new RangeError('not an ISO 8601 instant');
  return new Date(text);
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(timeZone, created);
  return created;
}

interface WallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly minutes: number;
  readonly seconds: number;
}

function wallClock(instant: Instant, timeZone: string): WallClock {
  if (Number.isNaN(instant.getTime())) throw new RangeError('invalid instant');
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return {
    year: parts['year'] ?? 0,
    month: parts['month'] ?? 0,
    day: parts['day'] ?? 0,
    minutes: (parts['hour'] ?? 0) * 60 + (parts['minute'] ?? 0),
    seconds: parts['second'] ?? 0,
  };
}

const pad = (value: number, width: number) => String(value).padStart(width, '0');

export function isLocalDate(text: unknown): text is string {
  if (typeof text !== 'string') return false;
  const match = LOCAL_DATE_PATTERN.exec(text);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** `YYYY-MM-DD` of `instant` in `timeZone` (the business zone by default). */
export function localDateOf(instant: Instant, timeZone = BUSINESS_TIME_ZONE): string {
  const { year, month, day } = wallClock(instant, timeZone);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Minutes since local midnight of `instant` in `timeZone`. */
export const localMinutesOf = (instant: Instant, timeZone = BUSINESS_TIME_ZONE): number =>
  wallClock(instant, timeZone).minutes;

export function addDays(date: string, days: number): string {
  if (!isLocalDate(date)) throw new RangeError('not a calendar date');
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const moved = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(moved.getUTCFullYear(), 4)}-${pad(moved.getUTCMonth() + 1, 2)}-${pad(moved.getUTCDate(), 2)}`;
}

function offsetMs(instant: Instant, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, 0, w.minutes, w.seconds);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock of `timeZone` reads `date` + `minutes`. */
export function zonedTimeToUtc(
  date: string,
  minutes: number,
  timeZone = BUSINESS_TIME_ZONE,
): Instant {
  if (!isLocalDate(date)) throw new RangeError('not a calendar date');
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
    throw new RangeError('minutes must be 0-1439');
  }
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

export interface InstantRange {
  readonly start: Instant;
  /** Exclusive. */
  readonly end: Instant;
}

/** Half-open `[start, end)` UTC range of one local day; consecutive days tile the timeline. */
export function localDayRange(date: string, timeZone = BUSINESS_TIME_ZONE): InstantRange {
  return {
    start: zonedTimeToUtc(date, 0, timeZone),
    end: zonedTimeToUtc(addDays(date, 1), 0, timeZone),
  };
}

export const addMinutes = (instant: Instant, minutes: number): Instant =>
  new Date(instant.getTime() + minutes * MS_PER_MINUTE);
