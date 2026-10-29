import {
  CIRCULAR_PLACEHOLDER,
  MASK_CHARACTER,
  MAX_REDACTION_DEPTH,
  PHONE_KEYS,
  PHONE_VISIBLE_DIGITS,
  REDACTION_PLACEHOLDER,
  SENSITIVE_KEYS,
  TRUNCATED_PLACEHOLDER,
} from '../../constants/logging';

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[_-]/g, '');

/** Masks every digit except the last `PHONE_VISIBLE_DIGITS`, keeping other characters (e.g. `+`). */
export const maskPhone = (value: string): string => {
  const digitCount = (value.match(/\d/g) ?? []).length;
  let seen = 0;
  return value.replace(/\d/g, (digit) => {
    seen += 1;
    return seen > digitCount - PHONE_VISIBLE_DIGITS ? digit : MASK_CHARACTER;
  });
};

const maskPhoneValue = (value: unknown): unknown => {
  if (typeof value === 'string') return maskPhone(value);
  if (typeof value === 'number') return maskPhone(String(value));
  if (Array.isArray(value)) return value.map(maskPhoneValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskPhoneValue(v)]));
  }
  return value;
};

const redactValue = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
  if (depth >= MAX_REDACTION_DEPTH) return TRUNCATED_PLACEHOLDER;
  seen.add(value);
  if (value instanceof Error) return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1, seen));
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (SENSITIVE_KEYS.has(normalized)) result[key] = REDACTION_PLACEHOLDER;
    else if (PHONE_KEYS.has(normalized)) result[key] = maskPhoneValue(child);
    else result[key] = redactValue(child, depth + 1, seen);
  }
  return result;
};

/** Returns a deep copy with secrets removed and phone numbers masked. Never mutates the input. */
export const redactSensitive = (input: Record<string, unknown>): Record<string, unknown> =>
  redactValue(input, 0, new WeakSet()) as Record<string, unknown>;
