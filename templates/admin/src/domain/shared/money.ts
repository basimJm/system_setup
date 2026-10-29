import {
  MINOR_UNITS_PER_MAJOR,
  MONEY_DECIMAL_PLACES,
  MONEY_STRING_PATTERN,
} from '../../constants/kernel';
import type { Brand } from './brand';

/** A money amount exactly as the API sends it: a decimal string with 1-3 decimals. Never a float. */
export type MoneyString = Brand<string, 'MoneyString'>;

const MINOR_PER_MAJOR_BIG = BigInt(MINOR_UNITS_PER_MAJOR);
const MAX_MINOR_BIG = BigInt(Number.MAX_SAFE_INTEGER);

export interface ParseMoneyOptions {
  /** Ledger adjustments are signed; prices and payments are not. */
  readonly allowNegative?: boolean;
}

/** Exact conversion to integer minor units, or `undefined` when `text` is not a valid amount. */
export function tryParseMoney(
  text: unknown,
  { allowNegative = false }: ParseMoneyOptions = {},
): number | undefined {
  if (typeof text !== 'string') return undefined;
  const match = MONEY_STRING_PATTERN.exec(text);
  if (match === null) return undefined;
  const [, sign = '', whole = '', fraction = ''] = match;
  if (sign !== '' && !allowNegative) return undefined;
  const magnitude =
    BigInt(whole) * MINOR_PER_MAJOR_BIG + BigInt(fraction.padEnd(MONEY_DECIMAL_PLACES, '0'));
  if (magnitude > MAX_MINOR_BIG) return undefined;
  return sign === '' || magnitude === 0n ? Number(magnitude) : -Number(magnitude);
}

export const isMoneyString = (value: unknown, options?: ParseMoneyOptions): value is MoneyString =>
  tryParseMoney(value, options) !== undefined;

/** `"12.5"` -> `12500`. Invalid input is a programmer/data error (the server validated it). */
export function moneyToMinor(text: string, options?: ParseMoneyOptions): number {
  const minor = tryParseMoney(text, options);
  if (minor === undefined) throw new RangeError('not a valid money amount');
  return minor;
}

export const isMinorUnits = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

/** `12500` -> `"12.500"`: always 3 decimals, integer arithmetic only. */
export function minorToMoney(minor: number): MoneyString {
  if (!isMinorUnits(minor)) throw new RangeError('minor units must be a safe integer');
  const magnitude = Math.abs(minor);
  const fraction = magnitude % MINOR_UNITS_PER_MAJOR;
  const whole = (magnitude - fraction) / MINOR_UNITS_PER_MAJOR;
  const sign = minor < 0 ? '-' : '';
  return `${sign}${String(whole)}.${String(fraction).padStart(MONEY_DECIMAL_PLACES, '0')}` as MoneyString;
}

/** Sums amounts without ever touching floating point. */
export function sumMoney(values: readonly string[], options?: ParseMoneyOptions): MoneyString {
  const total = values.reduce((sum, value) => sum + moneyToMinor(value, options), 0);
  if (!isMinorUnits(total)) throw new RangeError('sum is out of range');
  return minorToMoney(total);
}
