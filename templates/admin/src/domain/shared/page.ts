export interface PageMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/** What a list screen asks for; `page` starts at 1. */
export interface PageQuery {
  readonly page: number;
  readonly pageSize: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly meta: PageMeta;
}

/** Number of pages for `meta`; an empty list still has one (empty) page so the pager never shows 0 of 0. */
export function pageCount({ total, pageSize }: PageMeta): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Last page that exists for `meta` (used to step back after deleting the last row of a page). */
export function clampPage(page: number, meta: PageMeta): number {
  return Math.min(Math.max(1, page), pageCount(meta));
}

export function mapPage<T, U>(page: Page<T>, map: (item: T) => U): Page<U> {
  return { items: page.items.map(map), meta: page.meta };
}
