import {
  DAYS_OF_WEEK,
  DEFAULT_TIMEZONE,
  MINUTES_PER_DAY,
  MS_PER_DAY,
  MS_PER_MINUTE,
} from '../src/constants/time';
import { ValidationError } from '../src/utils/errors';
import {
  addDays,
  addMinutes,
  containsInstant,
  dayOfWeek,
  diffDays,
  formatHHmm,
  formatLocalDate,
  isHHmm,
  isLocalDate,
  isValidTimeZone,
  localDateOf,
  localDayRange,
  localMinutesOf,
  parseHHmm,
  parseLocalDate,
  rangesOverlap,
  utcOffsetMinutes,
  zonedTimeToUtc,
  type TimeRange,
} from '../src/utils/time';
import { createRandom, randomBetween, randomUpTo } from './helpers/random';

const AMMAN = 'Asia/Amman';
const NEW_YORK = 'America/New_York';
const LORD_HOWE = 'Australia/Lord_Howe';
const HAVANA = 'America/Havana';
const HOUR_MS = 60 * MS_PER_MINUTE;

const at = (iso: string): Date => new Date(iso);
const iso = (date: Date): string => date.toISOString();
const range = (start: string, end: string): TimeRange => ({ start: at(start), end: at(end) });
const hours = (span: TimeRange): number => (span.end.getTime() - span.start.getTime()) / HOUR_MS;

describe('time constants', () => {
  it('agree with each other', () => {
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(MINUTES_PER_DAY).toBe(1_440);
    expect(MS_PER_DAY).toBe(86_400_000);
    expect(DEFAULT_TIMEZONE).toBe('UTC');
  });

  it('list the domain weekdays in Date#getUTCDay order', () => {
    expect(DAYS_OF_WEEK).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
    // BUSINESS_DOMAIN.md: DayOfWeek = SAT | SUN | MON | TUE | WED | THU | FRI
    expect(new Set(DAYS_OF_WEEK)).toEqual(
      new Set(['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI']),
    );
  });
});

describe('HH:mm', () => {
  it.each([
    ['00:00', 0],
    ['00:01', 1],
    ['01:00', 60],
    ['07:30', 450],
    ['12:00', 720],
    ['12:59', 779],
    ['23:00', 1_380],
    ['23:59', 1_439],
  ])('parses %p as %p minutes', (text, minutes) => {
    expect(isHHmm(text)).toBe(true);
    expect(parseHHmm(text)).toBe(minutes);
    expect(formatHHmm(minutes)).toBe(text);
  });

  it.each([
    '',
    '24:00',
    '24:01',
    '7:30',
    '07:5',
    '7:3',
    '07:60',
    '07-30',
    '07.30',
    '07:30:00',
    ' 07:30',
    '07:30 ',
    '07:30\n',
    '٠٧:٣٠',
    '０７:３０',
    'ab:cd',
    '1230',
    '12:3a',
    '+7:30',
    '-1:30',
    '07:30pm',
  ])('rejects %j', (text) => {
    expect(isHHmm(text)).toBe(false);
    expect(() => parseHHmm(text)).toThrow(ValidationError);
  });

  it.each([450, null, undefined, {}, ['07:30']])('rejects the non-string %p', (value) => {
    expect(isHHmm(value)).toBe(false);
    expect(() => parseHHmm(value as string)).toThrow(ValidationError);
  });

  it('formats every minute of the day and parses it back', () => {
    for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += 1) {
      expect(parseHHmm(formatHHmm(minutes))).toBe(minutes);
    }
  });

  it.each([-1, 1_440, 1.5, NaN, Infinity, '60'])('refuses to format %p', (minutes) => {
    expect(() => formatHHmm(minutes as number)).toThrow(RangeError);
  });
});

describe('calendar dates', () => {
  it.each(['1970-01-01', '2000-02-29', '2024-02-29', '2026-10-12', '2026-12-31', '9999-12-31'])(
    'accepts %p',
    (date) => {
      expect(isLocalDate(date)).toBe(true);
      expect(formatLocalDate(parseLocalDate(date))).toBe(date);
    },
  );

  it.each([
    '2026-02-30',
    '2026-02-29',
    '2100-02-29', // 2100 is not a leap year
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-10-32',
    '2026-1-5',
    '26-01-01',
    '2026/01/01',
    '2026-01-01T00:00',
    '1969-12-31', // before the supported years
    '0000-01-01',
    ' 2026-01-01',
    '2026-01-01 ',
    '٢٠٢٦-٠١-٠١',
    '',
  ])('rejects %j', (date) => {
    expect(isLocalDate(date)).toBe(false);
    expect(() => parseLocalDate(date)).toThrow(ValidationError);
  });

  it.each([20_261_012, null, undefined, {}, new Date()])('rejects the non-string %p', (value) => {
    expect(isLocalDate(value)).toBe(false);
  });

  it('gives the parts of a date', () => {
    expect(parseLocalDate('2026-10-12')).toEqual({ year: 2026, month: 10, day: 12 });
    expect(formatLocalDate({ year: 1970, month: 1, day: 2 })).toBe('1970-01-02');
  });

  it.each([
    ['2026-10-12', 0, '2026-10-12'],
    ['2026-10-12', 90, '2027-01-10'], // 90 days ahead
    ['2026-10-12', 365, '2027-10-12'],
    ['2026-10-12', -284, '2026-01-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-29', 1, '2028-03-01'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
  ])('addDays(%p, %p) = %p', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });

  it('refuses to leave the supported years or take a fraction of a day', () => {
    expect(() => addDays('1970-01-01', -1)).toThrow(RangeError);
    expect(() => addDays('9999-12-31', 1)).toThrow(RangeError);
    expect(() => addDays('2026-10-12', 1.5)).toThrow(TypeError);
    expect(() => addDays('2026-10-12', NaN)).toThrow(TypeError);
    expect(() => addDays('2026-02-30', 1)).toThrow(ValidationError);
  });

  it.each([
    ['2026-10-12', '2026-10-12', 0],
    ['2026-10-12', '2027-01-10', 90],
    ['2027-01-10', '2026-10-12', -90],
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-28', '2028-03-01', 2], // leap year
    ['2027-02-28', '2027-03-01', 1],
  ])('diffDays(%p, %p) = %p', (from, to, expected) => {
    expect(diffDays(from, to)).toBe(expected);
  });

  it.each([
    ['1970-01-01', 'THU'],
    ['2000-01-01', 'SAT'],
    ['2024-02-29', 'THU'],
    ['2026-01-01', 'THU'],
    ['2026-10-12', 'MON'],
    ['2026-10-17', 'SAT'],
    ['2026-10-18', 'SUN'],
  ])('%p is a %p', (date, weekday) => {
    expect(dayOfWeek(date)).toBe(weekday);
  });
});

describe('time zones', () => {
  it.each(['Asia/Amman', 'UTC', NEW_YORK, LORD_HOWE])('knows %p', (zone) => {
    expect(isValidTimeZone(zone)).toBe(true);
  });

  it.each(['', 'Mars/Base', 'Asia/Amman ', 'asia amman', 123, null, undefined])(
    'does not know %p',
    (zone) => {
      expect(isValidTimeZone(zone)).toBe(false);
    },
  );

  it('rejects an unknown zone instead of guessing', () => {
    const now = at('2026-10-12T12:00:00Z');
    expect(() => localDateOf(now, 'Mars/Base')).toThrow(RangeError);
    expect(() => localDateOf(now, 'Mars/Base')).toThrow('invalid time zone: Mars/Base');
    expect(() => zonedTimeToUtc('2026-10-12', 0, 'Mars/Base')).toThrow(RangeError);
  });

  it('never falls back to the server zone when none is given', () => {
    const now = at('2026-10-12T12:00:00Z');
    expect(() => localDateOf(now, undefined as unknown as string)).toThrow(RangeError);
    expect(() => localMinutesOf(now, '')).toThrow(RangeError);
  });

  it('rejects an invalid Date', () => {
    expect(() => localDateOf(new Date(NaN), AMMAN)).toThrow(TypeError);
    expect(() => localMinutesOf('2026-10-12' as unknown as Date, AMMAN)).toThrow(TypeError);
    expect(() => utcOffsetMinutes(new Date(NaN), AMMAN)).toThrow(TypeError);
  });
});

describe('Asia/Amman: the business day changes at 21:00 UTC', () => {
  it.each([
    ['2026-10-12T20:59:59.999Z', '2026-10-12', 1_439],
    ['2026-10-12T21:00:00.000Z', '2026-10-13', 0],
    ['2026-10-12T21:00:00.001Z', '2026-10-13', 0],
    ['2026-10-12T00:00:00.000Z', '2026-10-12', 180],
    ['2026-10-12T12:00:00.000Z', '2026-10-12', 900],
    ['2026-01-15T20:59:59.999Z', '2026-01-15', 1_439], // winter: same offset since Oct 2022
    ['2026-01-15T21:00:00.000Z', '2026-01-16', 0],
    ['2026-07-15T20:59:59.999Z', '2026-07-15', 1_439],
    ['2026-07-15T21:00:00.000Z', '2026-07-16', 0],
    ['2026-12-31T21:00:00.000Z', '2027-01-01', 0], // new year
    ['2028-02-28T21:00:00.000Z', '2028-02-29', 0], // leap day
    ['2028-02-29T21:00:00.000Z', '2028-03-01', 0],
  ])('%s is %s at minute %p', (instant, date, minutes) => {
    expect(localDateOf(at(instant), AMMAN)).toBe(date);
    expect(localMinutesOf(at(instant), AMMAN)).toBe(minutes);
  });

  it('is UTC+3 all year (Jordan abolished daylight saving in 2022)', () => {
    expect(utcOffsetMinutes(at('2026-01-15T12:00:00Z'), AMMAN)).toBe(180);
    expect(utcOffsetMinutes(at('2026-07-15T12:00:00Z'), AMMAN)).toBe(180);
  });

  it('turns local times into instants', () => {
    expect(iso(zonedTimeToUtc('2026-10-13', 0, AMMAN))).toBe('2026-10-12T21:00:00.000Z');
    expect(iso(zonedTimeToUtc('2026-10-12', 8 * 60 + 30, AMMAN))).toBe('2026-10-12T05:30:00.000Z');
    expect(iso(zonedTimeToUtc('2026-10-12', 1_439, AMMAN))).toBe('2026-10-12T20:59:00.000Z');
  });

  it('has a 24-hour business day', () => {
    const day = localDayRange('2026-10-12', AMMAN);
    expect(iso(day.start)).toBe('2026-10-11T21:00:00.000Z');
    expect(iso(day.end)).toBe('2026-10-12T21:00:00.000Z');
  });

  it('lets a range run past local midnight into the next business day', () => {
    const start = zonedTimeToUtc('2026-10-12', 23 * 60 + 30, AMMAN);
    const end = addMinutes(start, 90);
    expect(localDateOf(start, AMMAN)).toBe('2026-10-12');
    expect(localDateOf(end, AMMAN)).toBe('2026-10-13');
    expect(localMinutesOf(end, AMMAN)).toBe(60);
  });

  it('moves the "today + 90 days" window exactly at local midnight', () => {
    const lastDay = (now: string): string => addDays(localDateOf(at(now), AMMAN), 90);
    expect(lastDay('2026-10-12T20:59:59.999Z')).toBe('2027-01-10');
    expect(lastDay('2026-10-12T21:00:00.000Z')).toBe('2027-01-11');
  });
});

describe('daylight saving', () => {
  it('moves a time that does not exist forward by the length of the gap (New York, 2026-03-08)', () => {
    // Clocks jump from 02:00 to 03:00, so 02:30 never shows; it becomes 03:30 EDT.
    expect(iso(zonedTimeToUtc('2026-03-08', 150, NEW_YORK))).toBe('2026-03-08T07:30:00.000Z');
    expect(iso(zonedTimeToUtc('2026-03-08', 180, NEW_YORK))).toBe('2026-03-08T07:00:00.000Z');
    expect(iso(zonedTimeToUtc('2026-03-08', 119, NEW_YORK))).toBe('2026-03-08T06:59:00.000Z');
    expect(localMinutesOf(zonedTimeToUtc('2026-03-08', 150, NEW_YORK), NEW_YORK)).toBe(210);
  });

  it('takes the first of two identical local times (New York, 2026-11-01)', () => {
    // 01:30 shows twice: at 05:30Z (EDT) and again at 06:30Z (EST). The first one wins.
    expect(iso(zonedTimeToUtc('2026-11-01', 90, NEW_YORK))).toBe('2026-11-01T05:30:00.000Z');
    expect(localMinutesOf(at('2026-11-01T05:30:00Z'), NEW_YORK)).toBe(90);
    expect(localMinutesOf(at('2026-11-01T06:30:00Z'), NEW_YORK)).toBe(90);
  });

  it('takes the first of two identical local times in a 30-minute overlap (Lord Howe, 2026-04-05)', () => {
    expect(iso(zonedTimeToUtc('2026-04-05', 105, LORD_HOWE))).toBe('2026-04-04T14:45:00.000Z');
  });

  it('has business days of 23, 24 and 25 hours (New York)', () => {
    expect(hours(localDayRange('2026-03-08', NEW_YORK))).toBe(23);
    expect(hours(localDayRange('2026-06-01', NEW_YORK))).toBe(24);
    expect(hours(localDayRange('2026-11-01', NEW_YORK))).toBe(25);
    expect(localDayRange('2026-03-08', NEW_YORK)).toEqual(
      range('2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z'),
    );
  });

  it('has business days of 23.5 and 24.5 hours in Lord Howe', () => {
    expect(hours(localDayRange('2026-04-05', LORD_HOWE))).toBe(24.5);
    expect(hours(localDayRange('2026-10-04', LORD_HOWE))).toBe(23.5);
  });

  it('starts a day at 01:00 when midnight does not exist (Havana, 2026-03-08)', () => {
    const day = localDayRange('2026-03-08', HAVANA);
    expect(iso(day.start)).toBe('2026-03-08T05:00:00.000Z');
    expect(localMinutesOf(day.start, HAVANA)).toBe(60);
    expect(hours(day)).toBe(23);
  });

  it('handles zones whose offset is not a whole hour', () => {
    expect(utcOffsetMinutes(at('2026-06-01T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
    expect(iso(zonedTimeToUtc('2026-06-01', 0, 'Asia/Kolkata'))).toBe('2026-05-31T18:30:00.000Z');
  });

  it('adds minutes as plain elapsed time, so a wall clock can jump (New York, 2026-03-08)', () => {
    const noon = zonedTimeToUtc('2026-03-07', 12 * 60, NEW_YORK);
    const nextDay = addMinutes(noon, MINUTES_PER_DAY);
    expect(localDateOf(nextDay, NEW_YORK)).toBe('2026-03-08');
    expect(localMinutesOf(nextDay, NEW_YORK)).toBe(13 * 60);
  });

  it.each([-1, 1_440, 1.5, NaN])('refuses the minute %p', (minutes) => {
    expect(() => zonedTimeToUtc('2026-10-12', minutes, AMMAN)).toThrow(RangeError);
  });

  it('refuses an impossible date', () => {
    expect(() => zonedTimeToUtc('2026-02-30', 0, AMMAN)).toThrow(ValidationError);
    expect(() => localDayRange('9999-12-31', 'UTC')).toThrow(RangeError);
  });
});

describe('ranges', () => {
  const nine = range('2026-10-12T09:00:00Z', '2026-10-12T10:00:00Z');

  it('overlap when they share time', () => {
    expect(rangesOverlap(nine, range('2026-10-12T09:30:00Z', '2026-10-12T10:30:00Z'))).toBe(true);
    expect(rangesOverlap(nine, range('2026-10-12T08:30:00Z', '2026-10-12T09:30:00Z'))).toBe(true);
    expect(rangesOverlap(nine, range('2026-10-12T09:15:00Z', '2026-10-12T09:45:00Z'))).toBe(true);
    expect(rangesOverlap(nine, range('2026-10-12T08:00:00Z', '2026-10-12T11:00:00Z'))).toBe(true);
    expect(rangesOverlap(nine, nine)).toBe(true);
    expect(rangesOverlap(nine, range('2026-10-12T09:59:00Z', '2026-10-12T10:30:00Z'))).toBe(true);
  });

  it('do not overlap when one ends exactly as the other starts (back-to-back ranges)', () => {
    const after = range('2026-10-12T10:00:00Z', '2026-10-12T11:00:00Z');
    const before = range('2026-10-12T08:00:00Z', '2026-10-12T09:00:00Z');
    expect(rangesOverlap(nine, after)).toBe(false);
    expect(rangesOverlap(after, nine)).toBe(false);
    expect(rangesOverlap(nine, before)).toBe(false);
    expect(rangesOverlap(before, nine)).toBe(false);
  });

  it('do not overlap when apart', () => {
    expect(rangesOverlap(nine, range('2026-10-12T12:00:00Z', '2026-10-12T13:00:00Z'))).toBe(false);
  });

  it('refuse a range that is empty, reversed or has an invalid Date', () => {
    const empty = range('2026-10-12T09:00:00Z', '2026-10-12T09:00:00Z');
    const reversed = range('2026-10-12T10:00:00Z', '2026-10-12T09:00:00Z');
    expect(() => rangesOverlap(empty, nine)).toThrow(RangeError);
    expect(() => rangesOverlap(nine, reversed)).toThrow(RangeError);
    expect(() => rangesOverlap(nine, { start: new Date(NaN), end: nine.end })).toThrow(TypeError);
    expect(() => containsInstant(reversed, nine.start)).toThrow(RangeError);
  });

  it('contain their start but not their end', () => {
    expect(containsInstant(nine, at('2026-10-12T09:00:00.000Z'))).toBe(true);
    expect(containsInstant(nine, at('2026-10-12T09:59:59.999Z'))).toBe(true);
    expect(containsInstant(nine, at('2026-10-12T10:00:00.000Z'))).toBe(false);
    expect(containsInstant(nine, at('2026-10-12T08:59:59.999Z'))).toBe(false);
    expect(() => containsInstant(nine, new Date(NaN))).toThrow(TypeError);
  });

  it('decide "is the place open now" with [open, close)', () => {
    const open = {
      start: zonedTimeToUtc('2026-10-12', parseHHmm('10:00'), AMMAN),
      end: zonedTimeToUtc('2026-10-12', parseHHmm('22:00'), AMMAN),
    };
    expect(containsInstant(open, at('2026-10-12T07:00:00Z'))).toBe(true); // 10:00 local
    expect(containsInstant(open, at('2026-10-12T06:59:59Z'))).toBe(false);
    expect(containsInstant(open, at('2026-10-12T19:00:00Z'))).toBe(false); // 22:00 local
  });

  it('add minutes in either direction', () => {
    const start = at('2026-10-12T09:00:00Z');
    expect(iso(addMinutes(start, 90))).toBe('2026-10-12T10:30:00.000Z');
    expect(iso(addMinutes(start, -30))).toBe('2026-10-12T08:30:00.000Z');
    expect(iso(addMinutes(start, 0))).toBe('2026-10-12T09:00:00.000Z');
    expect(start.toISOString()).toBe('2026-10-12T09:00:00.000Z'); // input is not changed
    expect(() => addMinutes(start, 1.5)).toThrow(TypeError);
    expect(() => addMinutes(new Date(NaN), 1)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------------------------
// Property-style tests. The checks below use no zone rules written in this file: they compare the
// utilities with brute-force searches over what the runtime's own tz database says, so they keep
// passing (and stay meaningful) when a country changes its clocks.
// ---------------------------------------------------------------------------------------------

const SEED = 20_261_013;
const ZONES = [
  AMMAN,
  'UTC',
  NEW_YORK,
  'Europe/London',
  'Europe/Berlin',
  LORD_HOWE,
  'Asia/Kolkata',
  'Asia/Kathmandu', // +05:45
  HAVANA, // clocks change at midnight
  'Africa/Cairo', // clocks change at midnight
  'Asia/Beirut', // clocks change at midnight
  'Pacific/Auckland',
  'America/Sao_Paulo',
];
const SLOT_MS = 15 * MS_PER_MINUTE;

/** A reader of the wall clock written separately from the implementation under test. */
const readers = new Map<string, Intl.DateTimeFormat>();
const wallMsAt = (instantMs: number, zone: string): number => {
  let reader = readers.get(zone);
  if (reader === undefined) {
    reader = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    readers.set(zone, reader);
  }
  const value = new Map<string, string>(
    reader.formatToParts(new Date(instantMs)).map((p) => [p.type, p.value]),
  );
  const read = (type: string): number => Number(value.get(type));
  return Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
};
const offsetMinutesAt = (instantMs: number, zone: string): number =>
  Math.round((wallMsAt(instantMs, zone) - Math.floor(instantMs / 1_000) * 1_000) / MS_PER_MINUTE);

/** Instants (minute precision) at which the zone's UTC offset changes, found by scanning days. */
const findTransitions = (zone: string, fromYear: number, toYear: number): number[] => {
  const found: number[] = [];
  const end = Date.UTC(toYear, 0, 1);
  let previous = offsetMinutesAt(Date.UTC(fromYear, 0, 1), zone);
  for (let day = Date.UTC(fromYear, 0, 2); day <= end; day += MS_PER_DAY) {
    const current = offsetMinutesAt(day, zone);
    if (current === previous) continue;
    let low = day - MS_PER_DAY;
    let high = day;
    while (high - low > MS_PER_MINUTE) {
      const middle = low + Math.floor((high - low) / 2 / MS_PER_MINUTE) * MS_PER_MINUTE;
      if (offsetMinutesAt(middle, zone) === previous) low = middle;
      else high = middle;
    }
    found.push(high);
    previous = current;
  }
  return found;
};

const randomInstant = (rand: () => number, fromYear: number, toYear: number): Date => {
  const from = Date.UTC(fromYear, 0, 1);
  const minutes = (Date.UTC(toYear, 0, 1) - from) / MS_PER_MINUTE;
  return new Date(from + randomUpTo(rand, minutes) * MS_PER_MINUTE);
};

const toLocalParts = (wallMs: number): { date: string; minutes: number } => {
  const wall = new Date(wallMs);
  return {
    date: wall.toISOString().slice(0, 10),
    minutes: wall.getUTCHours() * 60 + wall.getUTCMinutes(),
  };
};

describe('properties of local time', () => {
  it('Asia/Amman equals plain UTC+3 arithmetic since the 2022 law change', () => {
    const rand = createRandom(SEED);
    for (let i = 0; i < 3_000; i += 1) {
      const instant = new Date(
        Date.UTC(2023, 0, 1) + randomUpTo(rand, Date.UTC(2031, 0, 1) - Date.UTC(2023, 0, 1)),
      );
      const shifted = new Date(instant.getTime() + 3 * HOUR_MS);
      expect(localDateOf(instant, AMMAN)).toBe(shifted.toISOString().slice(0, 10));
      expect(localMinutesOf(instant, AMMAN)).toBe(
        shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
      );
    }
  });

  it('turning an instant into local date + minutes and back gives the same wall clock', () => {
    const rand = createRandom(SEED + 1);
    for (const zone of ZONES) {
      for (let i = 0; i < 300; i += 1) {
        const instant = randomInstant(rand, 2024, 2031);
        const date = localDateOf(instant, zone);
        const minutes = localMinutesOf(instant, zone);
        const back = zonedTimeToUtc(date, minutes, zone);
        // The same wall clock; and never later than the instant (the second pass through an
        // hour that is shown twice maps to its first pass, at most 2 hours earlier).
        expect(localDateOf(back, zone)).toBe(date);
        expect(localMinutesOf(back, zone)).toBe(minutes);
        expect(back.getTime()).toBeLessThanOrEqual(instant.getTime());
        expect(instant.getTime() - back.getTime()).toBeLessThan(2 * HOUR_MS);
      }
    }
  });

  it('agrees with a brute-force search at every daylight-saving change (15-minute grid)', () => {
    let transitionsChecked = 0;
    let gaps = 0;
    let overlaps = 0;
    for (const zone of ZONES) {
      for (const transition of findTransitions(zone, 2025, 2029)) {
        transitionsChecked += 1;
        const center = Math.round(wallMsAt(transition, zone) / SLOT_MS) * SLOT_MS;
        for (let step = -8; step <= 8; step += 1) {
          const wall = center + step * SLOT_MS;
          const { date, minutes } = toLocalParts(wall);
          const result = zonedTimeToUtc(date, minutes, zone);

          const matches: number[] = [];
          for (let t = wall - 15 * HOUR_MS; t <= wall + 13 * HOUR_MS; t += SLOT_MS) {
            if (wallMsAt(t, zone) === wall) matches.push(t);
          }
          if (matches.length > 0) {
            if (matches.length > 1) overlaps += 1;
            expect(result.getTime()).toBe(Math.min(...matches));
          } else {
            gaps += 1;
            // Never shown: pushed forward by the gap, i.e. read with the offset before the change.
            const before = offsetMinutesAt(wall - MS_PER_DAY, zone);
            const after = offsetMinutesAt(wall + MS_PER_DAY, zone);
            expect(result.getTime()).toBe(wall - before * MS_PER_MINUTE);
            expect(wallMsAt(result.getTime(), zone) - wall).toBe((after - before) * MS_PER_MINUTE);
          }
        }
      }
    }
    // The zones above must really exercise both cases, or this test proves nothing.
    expect(transitionsChecked).toBeGreaterThan(30);
    expect(gaps).toBeGreaterThan(10);
    expect(overlaps).toBeGreaterThan(10);
  });

  it('splits time into business days with no gap and no overlap', () => {
    const rand = createRandom(SEED + 2);
    for (const zone of ZONES) {
      for (let i = 0; i < 150; i += 1) {
        const instant = randomInstant(rand, 2024, 2031);
        const date = localDateOf(instant, zone);
        const day = localDayRange(date, zone);
        const previous = localDayRange(addDays(date, -1), zone);
        const next = localDayRange(addDays(date, 1), zone);

        expect(containsInstant(day, instant)).toBe(true);
        expect(containsInstant(previous, instant)).toBe(false);
        expect(containsInstant(next, instant)).toBe(false);
        expect(day.end.getTime()).toBe(next.start.getTime());
        expect(previous.end.getTime()).toBe(day.start.getTime());
        expect(hours(day)).toBeGreaterThanOrEqual(23);
        expect(hours(day)).toBeLessThanOrEqual(25);
        expect(localDateOf(day.start, zone)).toBe(date);
        expect(localDateOf(new Date(day.end.getTime() - 1), zone)).toBe(date);
      }
    }
  });
});

describe('properties of calendar dates', () => {
  /** Sakamoto's algorithm: 0 = Sunday. Written independently of the implementation. */
  const weekdayIndex = (year: number, month: number, day: number): number => {
    const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    const y = month < 3 ? year - 1 : year;
    return (
      (y +
        Math.floor(y / 4) -
        Math.floor(y / 100) +
        Math.floor(y / 400) +
        (offsets[month - 1] ?? 0) +
        day) %
      7
    );
  };

  /** A random date from `minEpochDay` (days since 1970-01-01) up to the year 2200. */
  const randomDate = (rand: () => number, minEpochDay = 0): string => {
    const epochDay = randomBetween(
      rand,
      minEpochDay,
      Math.floor(Date.UTC(2200, 0, 1) / MS_PER_DAY),
    );
    return new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10);
  };

  it('computes the weekday like an independent algorithm', () => {
    const rand = createRandom(SEED + 3);
    for (let i = 0; i < 3_000; i += 1) {
      const date = randomDate(rand);
      const { year, month, day } = parseLocalDate(date);
      expect(dayOfWeek(date)).toBe(DAYS_OF_WEEK[weekdayIndex(year, month, day)]);
    }
  });

  it('keeps addDays and diffDays inverse to each other', () => {
    const rand = createRandom(SEED + 4);
    const maxStep = 5_000; // stays clear of the first supported day, which addDays refuses to pass
    for (let i = 0; i < 3_000; i += 1) {
      const date = randomDate(rand, maxStep);
      const days = randomBetween(rand, -maxStep, maxStep);
      const moved = addDays(date, days);
      expect(diffDays(date, moved)).toBe(days);
      expect(addDays(moved, -days)).toBe(date);
      expect(isLocalDate(moved)).toBe(true);
      expect(dayOfWeek(addDays(date, 7))).toBe(dayOfWeek(date));
    }
  });

  it('steps through the week in order', () => {
    const rand = createRandom(SEED + 5);
    for (let i = 0; i < 500; i += 1) {
      const date = randomDate(rand);
      const index = DAYS_OF_WEEK.indexOf(dayOfWeek(date));
      expect(dayOfWeek(addDays(date, 1))).toBe(DAYS_OF_WEEK[(index + 1) % 7]);
    }
  });
});

describe('properties of ranges', () => {
  it('overlap exactly when some whole minute lies in both ranges (brute force)', () => {
    const rand = createRandom(SEED + 6);
    const base = at('2026-10-12T00:00:00Z');
    const make = (): { span: TimeRange; first: number; last: number } => {
      const first = randomUpTo(rand, 40);
      const last = first + 1 + randomUpTo(rand, 20); // exclusive end
      return { span: { start: addMinutes(base, first), end: addMinutes(base, last) }, first, last };
    };
    for (let i = 0; i < 4_000; i += 1) {
      const a = make();
      const b = make();
      let shared = false;
      for (let minute = 0; minute < 80; minute += 1) {
        if (minute >= a.first && minute < a.last && minute >= b.first && minute < b.last)
          shared = true;
      }
      expect(rangesOverlap(a.span, b.span)).toBe(shared);
      expect(rangesOverlap(b.span, a.span)).toBe(shared);
    }
  });

  it('never overlap a range with the one that starts where it ends', () => {
    const rand = createRandom(SEED + 7);
    for (let i = 0; i < 1_000; i += 1) {
      const start = randomInstant(rand, 2026, 2028);
      const first = { start, end: addMinutes(start, 5 + randomUpTo(rand, 600)) };
      const second = { start: first.end, end: addMinutes(first.end, 5 + randomUpTo(rand, 600)) };
      expect(rangesOverlap(first, second)).toBe(false);
      expect(rangesOverlap(second, first)).toBe(false);
    }
  });
});
