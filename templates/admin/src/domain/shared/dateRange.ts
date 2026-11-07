import { BUSINESS_TIME_ZONE, MS_PER_DAY } from '@/constants/kernel';
import {
  DEFAULT_DATE_PRESET,
  LAST_30_DAYS,
  LAST_7_DAYS,
  type RangePreset,
  type DatePreset,
} from '@/constants/dateRange';
import { addDays, isLocalDate, localDateOf, localDayRange, type InstantRange } from './time';

/** Inclusive range of calendar days (`YYYY-MM-DD`, Etc/GMT-3 unless said otherwise). */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export interface DateRangeValue extends DateRange {
  readonly preset: DatePreset;
  /** Also load the period right before this one (Admin PRD §2). */
  readonly compare: boolean;
}

const monthStart = (date: string): string => `${date.slice(0, 8)}01`;
const yearStart = (date: string): string => `${date.slice(0, 5)}01-01`;

/** The days a preset covers on the day of `now`. `custom` has no days of its own: callers keep their own. */
export function resolvePreset(
  preset: RangePreset,
  now: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): DateRange {
  const today = localDateOf(now, timeZone);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yesterday = addDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case 'last7':
      return { from: addDays(today, 1 - LAST_7_DAYS), to: today };
    case 'last30':
      return { from: addDays(today, 1 - LAST_30_DAYS), to: today };
    case 'thisMonth':
      return { from: monthStart(today), to: today };
    case 'lastMonth': {
      const lastDay = addDays(monthStart(today), -1);
      return { from: monthStart(lastDay), to: lastDay };
    }
    case 'thisYear':
      return { from: yearStart(today), to: today };
  }
}

/** Number of days in the range, both ends included. */
export function daysIn(range: DateRange): number {
  const [fy, fm, fd] = range.from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = range.to.split('-').map(Number) as [number, number, number];
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(ms / MS_PER_DAY) + 1;
}

/** The period of the same length that ends the day before `range` starts. */
export function previousPeriod(range: DateRange): DateRange {
  const length = daysIn(range);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

/** A usable range: two real days, `from` not after `to`. */
export const isValidRange = (range: DateRange): boolean =>
  isLocalDate(range.from) && isLocalDate(range.to) && range.from <= range.to;

/** Half-open UTC instants covering every day of the range (what an API filtering by time needs). */
export function rangeToInstants(
  range: DateRange,
  timeZone: string = BUSINESS_TIME_ZONE,
): InstantRange {
  return {
    start: localDayRange(range.from, timeZone).start,
    end: localDayRange(range.to, timeZone).end,
  };
}

export function initialRangeValue(
  now: Date,
  preset: DatePreset = DEFAULT_DATE_PRESET,
): DateRangeValue {
  const days = resolvePreset(preset === 'custom' ? DEFAULT_DATE_PRESET : preset, now);
  return { preset, ...days, compare: false };
}
