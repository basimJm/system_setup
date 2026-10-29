/**
 * Time constants Instants are UTC; business dates and hours use the business
 * time zone (`settings.timezone`).
 */
export const MS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
export const MS_PER_DAY = MS_PER_MINUTE * MINUTES_PER_DAY;

/** Default of the `timezone` setting; services read the live value from settings. */
export const DEFAULT_TIMEZONE = 'UTC';

/** `Date#getUTCDay()` order. The values are the domain `DayOfWeek` enum (BUSINESS_DOMAIN.md). */
export const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/** Weekday of 1970-01-01 (epoch day 0) as an index into `DAYS_OF_WEEK` — a Thursday. */
export const EPOCH_DAY_OF_WEEK_INDEX = 4;

/** Strict 24-hour `HH:mm`, ASCII digits only. Groups: hours, minutes. */
export const HH_MM_PATTERN = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
/** `YYYY-MM-DD` shape only; whether the date exists is checked in code. Groups: year, month, day. */
export const LOCAL_DATE_PATTERN = /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[0-1])$/;

/** Calendar dates run from the Unix epoch year to the last 4-digit year. */
export const MIN_LOCAL_YEAR = 1970;
export const MAX_LOCAL_YEAR = 9999;

/** Widths of the zero-padded fields in `YYYY-MM-DD` and `HH:mm`. */
export const YEAR_DIGITS = 4;
export const PART_DIGITS = 2;

/** Locale used only to read the numeric parts of a date in a zone (Latin digits, no translation). */
export const TIME_PARTS_LOCALE = 'en-US';
