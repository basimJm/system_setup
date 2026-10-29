import type { Page, PageQuery } from '@/domain/shared/page';
import type { AdminResource } from '@/domain/shared/resource';
import type { ApiClient } from './ApiClient';
import type { Endpoint } from './endpoint';

interface Endpoints<T, TC, TP, TQ> {
  list: Endpoint<readonly T[], undefined, TQ>;
  create: Endpoint<T, TC, undefined>;
  update: Endpoint<T, TP, undefined>;
}

/** Builds list/create/update for one resource from its three endpoints; the audit reason travels in the body. */
export function resource<
  T,
  TC extends { reason: string },
  TP extends { reason: string },
  TQ,
  TF extends object,
>(
  api: ApiClient,
  e: Endpoints<T, TC, TP, TQ>,
  toQuery: (query: PageQuery & TF) => TQ,
): AdminResource<T, Omit<TC, 'reason'>, Omit<TP, 'reason'>, TF> {
  return {
    list: (query): Promise<Page<T>> => api.executePage(e.list, { query: toQuery(query) }),
    async create(input, reason) {
      // `input` is the body without the reason, so adding it back is exactly the endpoint's body type.
      const { data } = await api.execute(e.create, { body: { ...input, reason } as unknown as TC });
      return data;
    },
    async update(id, patch, reason) {
      const { data } = await api.execute(e.update, {
        params: { id },
        body: { ...patch, reason } as unknown as TP,
      });
      return data;
    },
  };
}

export const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
