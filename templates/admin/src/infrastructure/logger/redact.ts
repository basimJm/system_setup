import { MAX_LOG_DEPTH, REDACTED, SENSITIVE_KEY_PATTERN } from '@/constants/logging';

/** Deep-copies `value` with sensitive keys replaced. Handles cycles and depth; never mutates input. */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (seen.has(value)) return '[Circular]';
  if (depth >= MAX_LOG_DEPTH) return '[Truncated]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(item, depth + 1, seen);
  }
  return out;
}
