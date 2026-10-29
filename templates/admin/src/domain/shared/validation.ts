import { z } from 'zod';
import { MAX_TEXT_LENGTH } from '@/constants/ui';
import { tryParseMoney } from './money';
import { isLocalDate } from './time';

/**
 * Reusable zod building blocks. Messages are i18n keys (`validation.*`), translated by the field that shows them,
 * so every rule has one Arabic and one English text (same rules as the mobile apps, Admin PRD §3).
 */
export const VALIDATION_KEYS = {
  required: 'validation.required',
  tooLong: 'validation.tooLong',
  tooShort: 'validation.tooShort',
  invalidAmount: 'validation.invalidAmount',
  notPositive: 'validation.notPositive',
  invalidDate: 'validation.invalidDate',
  endBeforeStart: 'validation.endBeforeStart',
} as const;

export const requiredText = (min = 1, max = MAX_TEXT_LENGTH) =>
  z
    .string()
    .trim()
    .min(1, VALIDATION_KEYS.required)
    .min(min, VALIDATION_KEYS.tooShort)
    .max(max, VALIDATION_KEYS.tooLong);

/** A money decimal string (up to 3 decimals). `positive` also rejects zero. */
export const moneyAmount = ({ positive = false }: { positive?: boolean } = {}) =>
  z
    .string()
    .min(1, VALIDATION_KEYS.required)
    .refine((v) => v === '' || tryParseMoney(v) !== undefined, VALIDATION_KEYS.invalidAmount)
    .refine((v) => !positive || (tryParseMoney(v) ?? 0) > 0, VALIDATION_KEYS.notPositive);

/** `YYYY-MM-DD` that is a real calendar day. */
export const localDateString = () =>
  z.string().min(1, VALIDATION_KEYS.required).refine(isLocalDate, VALIDATION_KEYS.invalidDate);

type ObjectSchema = z.ZodType<Record<string, unknown>, Record<string, unknown>>;

/** Refinement: `end` must be strictly after `start` (schedules and validity periods, PRD §3). */
export function endAfterStart<S extends ObjectSchema>(
  schema: S,
  startKey: keyof z.output<S> & string,
  endKey: keyof z.output<S> & string,
): S {
  return schema.superRefine((value, ctx) => {
    const start = value[startKey];
    const end = value[endKey];
    if (typeof start === 'string' && typeof end === 'string' && end <= start) {
      ctx.addIssue({ code: 'custom', path: [endKey], message: VALIDATION_KEYS.endBeforeStart });
    }
  });
}
