import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VALIDATION_KEYS,
  endAfterStart,
  moneyAmount,
  localDateString,
  requiredText,
} from '@/domain/shared/validation';
import { AppError } from '@/infrastructure/errors/AppError';
import { useDebouncedValue } from '@/presentation/hooks/useDebouncedValue';
import { filterOptions } from '@/presentation/utils/filterOptions';
import { applyServerFieldErrors, errorText, messageOf } from '@/presentation/utils/formErrors';
import { sanitizeDecimal, toAsciiDigits } from '@/presentation/utils/numericInput';
import { z } from 'zod';

const messages = (result: { success: boolean; error?: z.ZodError }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe('toAsciiDigits', () => {
  it.each([
    ['١٢٣', '123'],
    ['۴۵۶', '456'],
    ['12a٣', '12a3'],
    ['', ''],
  ])('%j -> %j', (input, expected) => expect(toAsciiDigits(input)).toBe(expected));
});

describe('sanitizeDecimal', () => {
  it.each([
    ['12.3456', 3, false, '12.345'],
    ['12,5', 3, false, '12.5'],
    ['١٢٫٥', 3, false, '12.5'],
    ['1.2.3', 3, false, '1.23'],
    ['abc', 3, false, ''],
    ['12.5', 0, false, '12'],
    ['-5', 0, false, '5'],
    ['-5', 0, true, '-5'],
    ['5-', 0, true, '5'],
    ['.', 3, false, '.'],
    ['', 3, false, ''],
  ])('%j (decimals %i, negative %s) -> %j', (input, maxDecimals, allowNegative, expected) =>
    expect(sanitizeDecimal(input, { maxDecimals, allowNegative })).toBe(expected),
  );
});

describe('filterOptions', () => {
  const options = [
    { value: 'a', label: 'Northville' },
    { value: 'i', label: 'Eastford' },
    { value: 'z', label: 'Southport' },
  ];
  it('keeps everything for a blank query', () => {
    expect(filterOptions(options, '  ')).toHaveLength(3);
  });
  it('matches case-insensitively on the label', () => {
    expect(filterOptions(options, 'NORTH').map((o) => o.value)).toEqual(['a']);
    expect(filterOptions(options, 's').map((o) => o.value)).toEqual(['i', 'z']);
  });
  it('returns a copy and handles no match', () => {
    expect(filterOptions(options, 'x')).toEqual([]);
    expect(filterOptions(options, '')).not.toBe(options);
  });
});

describe('validation blocks', () => {
  it('requiredText trims, then enforces min and max', () => {
    const schema = requiredText(3, 5);
    expect(schema.safeParse('  abc ').data).toBe('abc');
    expect(messages(schema.safeParse('   '))).toContain(VALIDATION_KEYS.required);
    expect(messages(schema.safeParse('ab'))).toContain(VALIDATION_KEYS.tooShort);
    expect(messages(schema.safeParse('abcdef'))).toContain(VALIDATION_KEYS.tooLong);
  });

  it.each([
    ['12.5', true],
    ['0', true],
    ['12.5001', false],
    ['-1', false],
    ['1e3', false],
    ['٥', false],
  ])('moneyAmount accepts %j: %s', (value, ok) =>
    expect(moneyAmount().safeParse(value).success).toBe(ok),
  );

  it('moneyAmount({positive}) rejects zero and empty', () => {
    const schema = moneyAmount({ positive: true });
    expect(messages(schema.safeParse('0.000'))).toContain(VALIDATION_KEYS.notPositive);
    expect(messages(schema.safeParse(''))).toContain(VALIDATION_KEYS.required);
    expect(schema.safeParse('0.001').success).toBe(true);
  });

  it.each([
    ['2026-10-14', true],
    ['2026-02-30', false],
    ['2024-02-29', true],
    ['14/10/2026', false],
    ['', false],
  ])('localDateString accepts %j: %s', (value, ok) =>
    expect(localDateString().safeParse(value).success).toBe(ok),
  );

  it('endAfterStart marks the end field when it is not after the start', () => {
    const schema = endAfterStart(z.object({ start: z.string(), end: z.string() }), 'start', 'end');
    expect(schema.safeParse({ start: '2026-10-01', end: '2026-10-02' }).success).toBe(true);
    const same = schema.safeParse({ start: '2026-10-01', end: '2026-10-01' });
    expect(same.error?.issues[0]?.path).toEqual(['end']);
    expect(same.error?.issues[0]?.message).toBe(VALIDATION_KEYS.endBeforeStart);
    expect(schema.safeParse({ start: '2026-10-02', end: '2026-10-01' }).success).toBe(false);
  });
});

describe('form error helpers', () => {
  const t = ((key: string, options?: { defaultValue?: string }) =>
    key === 'validation.required' ? 'Required' : (options?.defaultValue ?? key)) as never;

  it('errorText translates keys, keeps server text, hides empty', () => {
    expect(errorText(t, 'validation.required')).toBe('Required');
    expect(errorText(t, 'Server says no')).toBe('Server says no');
    expect(errorText(t, undefined)).toBeUndefined();
    expect(errorText(t, '')).toBeUndefined();
  });

  it('messageOf reads string messages only', () => {
    expect(messageOf({ message: 'x' })).toBe('x');
    expect(messageOf({ message: 5 })).toBeUndefined();
    expect(messageOf(undefined)).toBeUndefined();
  });

  it('applyServerFieldErrors marks each server field once and reports whether any', () => {
    const setError = vi.fn();
    const withFields = new AppError({
      kind: 'validation',
      details: [
        { field: 'name.ar', message: 'Required', code: 'REQUIRED' },
        { field: 'name.ar', message: 'second', code: 'X' },
        { field: '', message: 'general', code: 'Y' },
      ],
    });
    expect(applyServerFieldErrors(setError, withFields)).toBe(true);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('name.ar', { type: 'server', message: 'Required' });
    expect(applyServerFieldErrors(setError, new AppError({ kind: 'server' }))).toBe(false);
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('only follows the value after it stayed unchanged for the delay', async () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 500), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'ab' });
    await act(() => vi.advanceTimersByTimeAsync(499));
    expect(result.current).toBe('a');
    rerender({ v: 'abc' });
    await act(() => vi.advanceTimersByTimeAsync(499));
    expect(result.current).toBe('a');
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current).toBe('abc');
  });
});
