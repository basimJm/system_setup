import { describe, expect, it } from 'vitest';
import { toId } from '@/domain/shared/brand';
import {
  formatInstant,
  formatMoneyAmount,
  formatNumber,
  localizeDigits,
} from '@/domain/shared/format';
import {
  minorToMoney,
  isMinorUnits,
  isMoneyString,
  moneyToMinor,
  sumMoney,
  tryParseMoney,
} from '@/domain/shared/money';
import { clampPage, mapPage, pageCount, type Page } from '@/domain/shared/page';
import { attempt, err, mapResult, ok } from '@/domain/shared/result';
import {
  addDays,
  addMinutes,
  isInstantString,
  isLocalDate,
  localDateOf,
  localDayRange,
  localMinutesOf,
  parseInstant,
  zonedTimeToUtc,
} from '@/domain/shared/time';

describe('ids', () => {
  it('accepts non-empty strings and rejects blank ones', () => {
    expect(toId<'Item'>('abc')).toBe('abc');
    expect(() => toId('  ')).toThrow(RangeError);
  });
});

describe('Page', () => {
  const meta = (total: number, pageSize = 25, page = 1) => ({ page, pageSize, total });
  it.each([
    [0, 1],
    [1, 1],
    [25, 1],
    [26, 2],
    [100, 4],
  ])('total %s -> %s page(s)', (total, pages) => expect(pageCount(meta(total))).toBe(pages));

  it('clamps a page into the existing range', () => {
    expect(clampPage(0, meta(60))).toBe(1);
    expect(clampPage(9, meta(60))).toBe(3);
    expect(clampPage(2, meta(60))).toBe(2);
  });

  it('maps items and keeps meta', () => {
    const page: Page<number> = { items: [1, 2], meta: meta(2) };
    expect(mapPage(page, (n) => n * 2)).toEqual({ items: [2, 4], meta: meta(2) });
  });
});

describe('Result', () => {
  it('maps values, passes errors through, and captures rejections', async () => {
    expect(mapResult(ok(2), (n) => n + 1)).toEqual(ok(3));
    expect(mapResult(err('x'), (n: number) => n + 1)).toEqual(err('x'));
    expect(await attempt(() => Promise.resolve(5))).toEqual(ok(5));
    const boom = new Error('boom');
    expect(await attempt(() => Promise.reject(boom))).toEqual(err(boom));
  });
});

describe('money', () => {
  it.each([
    ['0', 0],
    ['12.5', 12_500],
    ['12.500', 12_500],
    ['0.001', 1],
    ['9007199254740.991', Number.MAX_SAFE_INTEGER],
  ])('%s -> %s minor units', (text, minor) => expect(moneyToMinor(text)).toBe(minor));

  it.each([
    '',
    '1.',
    '.5',
    '01',
    '1.0001',
    '1,5',
    ' 1',
    '1e3',
    '١٢',
    '-1',
    'NaN',
    '9007199254740.992',
  ])('rejects %j', (text) => {
    expect(tryParseMoney(text)).toBeUndefined();
    expect(isMoneyString(text)).toBe(false);
    expect(() => moneyToMinor(text)).toThrow(RangeError);
  });

  it('allows negatives only when asked, and never returns negative zero', () => {
    expect(moneyToMinor('-0.5', { allowNegative: true })).toBe(-500);
    expect(Object.is(moneyToMinor('-0.000', { allowNegative: true }), 0)).toBe(true);
    expect(isMoneyString(12)).toBe(false);
  });

  it('formats minor units as 3-decimal strings and round-trips', () => {
    expect(minorToMoney(12_500)).toBe('12.500');
    expect(minorToMoney(1)).toBe('0.001');
    expect(minorToMoney(-500)).toBe('-0.500');
    for (const minor of [0, 7, 999, 1000, 123_456_789, -42]) {
      expect(moneyToMinor(minorToMoney(minor), { allowNegative: true })).toBe(minor);
    }
    expect(() => minorToMoney(1.5)).toThrow(RangeError);
    expect(isMinorUnits(1.5)).toBe(false);
  });

  it('sums exactly where floats would drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney(['0.100', '0.200'])).toBe('0.300');
    expect(sumMoney([])).toBe('0.000');
    expect(() => sumMoney(['1', 'x'])).toThrow(RangeError);
    expect(() => sumMoney(['9007199254740.991', '0.001'])).toThrow(RangeError);
  });
});

describe('time', () => {
  it('validates instants and calendar dates', () => {
    expect(isInstantString('2026-10-14T10:00:00Z')).toBe(true);
    expect(isInstantString('2026-10-14T10:00:00.123+03:00')).toBe(true);
    expect(isInstantString('2026-10-14')).toBe(false);
    expect(isInstantString('2026-13-14T10:00:00Z')).toBe(false);
    expect(() => parseInstant('tomorrow')).toThrow(RangeError);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2027-02-29')).toBe(false);
    expect(isLocalDate('2026-1-1')).toBe(false);
  });

  it('rolls the Amman day over at exactly 21:00:00.000Z', () => {
    expect(localDateOf(new Date('2026-10-14T20:59:59.999Z'))).toBe('2026-10-14');
    expect(localDateOf(new Date('2026-10-14T21:00:00.000Z'))).toBe('2026-10-15');
    expect(localMinutesOf(new Date('2026-10-14T21:30:00Z'))).toBe(30);
    expect(localDateOf(new Date('2026-12-31T21:00:00Z'))).toBe('2027-01-01');
  });

  it('converts wall time back to UTC and tiles days half-open', () => {
    expect(zonedTimeToUtc('2026-10-15', 0).toISOString()).toBe('2026-10-14T21:00:00.000Z');
    expect(zonedTimeToUtc('2026-10-15', 13 * 60 + 5).toISOString()).toBe(
      '2026-10-15T10:05:00.000Z',
    );
    const day = localDayRange('2026-10-15');
    expect(day.end).toEqual(localDayRange('2026-10-16').start);
    expect(localDateOf(addMinutes(day.end, -1))).toBe('2026-10-15');
    expect(() => zonedTimeToUtc('2026-10-15', 1440)).toThrow(RangeError);
    expect(() => zonedTimeToUtc('2026-02-30', 0)).toThrow(RangeError);
  });

  it('handles DST zones when asked (gap moves forward, day is 23 h)', () => {
    const ny = 'America/New_York';
    const range = localDayRange('2026-03-08', ny);
    expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(23);
    expect(localDateOf(new Date('2026-03-08T04:59:59Z'), ny)).toBe('2026-03-07');
  });

  it('adds days across month and leap boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(() => addDays('nope', 1)).toThrow(RangeError);
  });
});

describe('formatters', () => {
  it('localizes digits only for Arabic', () => {
    expect(localizeDigits('2026-10', 'ar')).toBe('٢٠٢٦-١٠');
    expect(localizeDigits('2026-10', 'en')).toBe('2026-10');
    expect(formatNumber(1234, 'en')).toBe('1,234');
    expect(formatNumber(1234, 'ar')).toContain('١');
  });

  it('formats JOD with 3 decimals, grouping, and language digits', () => {
    expect(formatMoneyAmount('1234.5', 'en')).toBe('1,234.500');
    expect(formatMoneyAmount('0.001', 'en')).toBe('0.001');
    expect(formatMoneyAmount('-12.5', 'en')).toBe('-12.500');
    expect(formatMoneyAmount('-0.000', 'en')).toBe('0.000');
    expect(formatMoneyAmount('9007199254740.991', 'en')).toBe('9,007,199,254,740.991');
    const ar = formatMoneyAmount('1234.5', 'ar');
    expect(ar).toMatch(/^١.٢٣٤٫٥٠٠$/);
    expect(() => formatMoneyAmount('1,5', 'en')).toThrow(RangeError);
  });

  it('shows instants in Amman with a 12-hour clock', () => {
    const iso = '2026-10-14T21:30:00Z';
    expect(formatInstant(iso, 'en', 'time')).toMatch(/^12:30\s?am$/i);
    expect(formatInstant(iso, 'en', 'date')).toBe('15 Oct 2026');
    expect(formatInstant(new Date('2026-10-14T10:05:00Z'), 'en', 'time')).toMatch(/^1:05\s?pm$/i);
    const ar = formatInstant(iso, 'ar', 'time');
    expect(ar).toMatch(/[٠-٩]/);
    expect(ar).toMatch(/ص/);
    expect(formatInstant(iso, 'en', 'dateTime', 'UTC')).toMatch(/9:30/);
  });
});
