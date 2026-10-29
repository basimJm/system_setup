import { type TypedAnswer } from './mockRoute';
import type { MockRequest } from './mockTransport';

export interface Row {
  id: string;
}

const withoutReason = (body: unknown): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([k]) => k !== 'reason'),
  );

const page = <T>(rows: T[], q: URLSearchParams): TypedAnswer<T[]> => {
  const pageSize = Number(q.get('pageSize') ?? 25);
  const current = Number(q.get('page') ?? 1);
  const start = (current - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    meta: {
      page: current,
      pageSize,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
    },
    empty: [],
  };
};

/** In-memory collection with list (filterable), create and patch, shared by the three location resources. */
export function collection<T extends Row>(
  seed: T[],
  idOf: () => string,
  defaults: Partial<T> = {},
) {
  const rows = [...seed];
  return {
    list: ({ query }: MockRequest) => {
      // Every query parameter that names a field of the rows is an equality filter (countryCode, cityId, app...).
      const filters = [...query.entries()].filter(([k]) => k !== 'page' && k !== 'pageSize');
      return page(
        rows.filter((r) =>
          filters.every(([k, v]) => !(k in r) || String((r as Record<string, unknown>)[k]) === v),
        ),
        query,
      );
    },
    create: ({ body }: MockRequest) => {
      const input = withoutReason(body);
      const row = { id: idOf(), ...defaults, ...input } as unknown as T;
      rows.push(row);
      return { data: row, status: 201 };
    },
    update: ({ params, body }: MockRequest) => {
      const patch = withoutReason(body);
      const index = rows.findIndex((r) => r.id === params['id']);
      const current = rows[index];
      if (!current) return { data: seed[0] as T };
      const next = { ...current, ...patch } as T;
      rows[index] = next;
      return { data: next };
    },
  };
}
