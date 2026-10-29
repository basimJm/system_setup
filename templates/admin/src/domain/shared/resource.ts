import type { Page, PageQuery } from './page';

/** The shape of an audited admin resource: paginated list, create and update (both with a reason). */
export interface AdminResource<T, TInput, TPatch, TFilter = object> {
  list(query: PageQuery & TFilter): Promise<Page<T>>;
  create(input: TInput, reason: string): Promise<T>;
  update(id: string, patch: TPatch, reason: string): Promise<T>;
}
