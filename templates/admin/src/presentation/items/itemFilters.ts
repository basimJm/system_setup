import { isItemOwnerType, isItemStatus, type ItemsQuery } from '@/domain/items/items';
import type { ListState } from '@/domain/shared/listState';

/** The filters an item list keeps in the URL (`useListController`). */
export const ITEM_FILTER_KEYS = ['status', 'ownerType', 'tag'] as const;

/** URL list state -> the query the repository takes; unknown values are dropped, never sent. */
export function itemQueryOf(state: ListState): ItemsQuery {
  const status = state.filters['status']?.[0];
  const ownerType = state.filters['ownerType']?.[0];
  const tag = state.filters['tag']?.[0];
  return {
    page: state.page,
    pageSize: state.pageSize,
    ...(state.search ? { q: state.search } : {}),
    ...(isItemStatus(status) ? { status } : {}),
    ...(isItemOwnerType(ownerType) ? { ownerType } : {}),
    ...(tag ? { tag } : {}),
  };
}
