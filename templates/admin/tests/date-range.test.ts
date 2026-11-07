import { describe, expect, it } from 'vitest';
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from '@/constants/dateRange';
import {
  daysIn,
  initialRangeValue,
  isValidRange,
  previousPeriod,
  rangeToInstants,
  resolvePreset,
} from '@/domain/shared/dateRange';

const at = (iso: string) => new Date(iso);
/** Wednesday 2026-10-14 12:00 in the business zone (UTC+3). */
const NOW = at('2026-10-14T09:00:00Z');

describe('resolvePreset', () => {
  it.each([
    ['today', '2026-10-14', '2026-10-14'],
    ['yesterday', '2026-10-13', '2026-10-13'],
    ['last7', '2026-10-08', '2026-10-14'],
    ['last30', '2026-09-15', '2026-10-14'],
    ['thisMonth', '2026-10-01', '2026-10-14'],
    ['lastMonth', '2026-09-01', '2026-09-30'],
    ['thisYear', '2026-01-01', '2026-10-14'],
  ] as const)('%s on 2026-10-14 -> %s .. %s', (preset, from, to) => {
    expect(resolvePreset(preset, NOW)).toEqual({ from, to });
  });

  it('uses the business-zone day, which starts at 21:00Z the evening before', () => {
    expect(resolvePreset('today', at('2026-10-13T20:59:59Z'))).toEqual({
      from: '2026-10-13',
      to: '2026-10-13',
    });
    expect(resolvePreset('today', at('2026-10-13T21:00:00Z'))).toEqual({
      from: '2026-10-14',
      to: '2026-10-14',
    });
  });

  it('last month in January is December of the previous year', () => {
    expect(resolvePreset('lastMonth', at('2026-01-10T09:00:00Z'))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('last month handles February in a leap year and a normal year', () => {
    expect(resolvePreset('lastMonth', at('2024-03-05T09:00:00Z'))).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(resolvePreset('lastMonth', at('2026-03-05T09:00:00Z'))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('crosses the year boundary for yesterday and the last 7 days', () => {
    const newYear = at('2026-01-01T09:00:00Z');
    expect(resolvePreset('yesterday', newYear).from).toBe('2025-12-31');
    expect(resolvePreset('last7', newYear)).toEqual({ from: '2025-12-26', to: '2026-01-01' });
  });

  it('the last 7 / 30 days really span 7 / 30 days', () => {
    expect(daysIn(resolvePreset('last7', NOW))).toBe(7);
    expect(daysIn(resolvePreset('last30', NOW))).toBe(30);
  });
});

describe('daysIn / previousPeriod', () => {
  it('counts both ends', () => {
    expect(daysIn({ from: '2026-10-14', to: '2026-10-14' })).toBe(1);
    expect(daysIn({ from: '2026-02-27', to: '2026-03-02' })).toBe(4);
    expect(daysIn({ from: '2024-02-27', to: '2024-03-02' })).toBe(5);
  });

  it('the previous period has the same length and ends the day before', () => {
    const range = { from: '2026-10-08', to: '2026-10-14' };
    const previous = previousPeriod(range);
    expect(previous).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(daysIn(previous)).toBe(daysIn(range));
  });

  it('works across months and years', () => {
    expect(previousPeriod({ from: '2026-01-01', to: '2026-01-31' })).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(previousPeriod({ from: '2026-03-01', to: '2026-03-01' })).toEqual({
      from: '2026-02-28',
      to: '2026-02-28',
    });
  });
});

describe('isValidRange', () => {
  it.each([
    ['2026-10-01', '2026-10-14', true],
    ['2026-10-14', '2026-10-14', true],
    ['2026-10-15', '2026-10-14', false],
    ['', '2026-10-14', false],
    ['2026-02-30', '2026-03-05', false],
  ])('%s .. %s -> %s', (from, to, expected) => {
    expect(isValidRange({ from, to })).toBe(expected);
  });
});

describe('rangeToInstants', () => {
  it('is the half-open UTC span of whole business-zone days', () => {
    const { start, end } = rangeToInstants({ from: '2026-10-13', to: '2026-10-14' });
    expect(start.toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-14T21:00:00.000Z');
  });
});

describe('initialRangeValue', () => {
  it('starts on the default preset without comparison', () => {
    const value = initialRangeValue(NOW);
    expect(value.preset).toBe(DEFAULT_DATE_PRESET);
    expect(value.compare).toBe(false);
    expect(value).toMatchObject(resolvePreset(DEFAULT_DATE_PRESET, NOW));
  });

  it('a custom start still resolves some days', () => {
    expect(initialRangeValue(NOW, 'custom').preset).toBe('custom');
    expect(isValidRange(initialRangeValue(NOW, 'custom'))).toBe(true);
  });

  it('presets are the ones of the PRD, custom last', () => {
    expect(DATE_PRESETS[DATE_PRESETS.length - 1]).toBe('custom');
    expect(DATE_PRESETS).toHaveLength(8);
  });
});
