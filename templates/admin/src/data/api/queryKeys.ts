import type { Endpoint } from './endpoint';

type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };

/** Same content, same key: object keys are sorted and undefined values dropped. */
function normalize(value: unknown): Json {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalize(v)]),
    );
  }
  return (value ?? null) as Json;
}

export interface KeyArgs {
  params?: Readonly<Record<string, string>>;
  query?: unknown;
}

/** TanStack Query key of one call: `[operationId, params, query]`. Invalidate a whole operation with `[operationId]`. */
export const queryKey = (
  endpoint: Endpoint<unknown, unknown, unknown>,
  args: KeyArgs = {},
): readonly unknown[] => [
  endpoint.op.id,
  normalize(args.params ?? {}),
  normalize(args.query ?? {}),
];
