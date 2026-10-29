/** Sample feature: a generic `items` collection owned by customers or merchant accounts. */
export const ITEMS_COLLECTION = 'items';
export const ITEM_TITLE_MIN_LENGTH = 1;
export const ITEM_TITLE_MAX_LENGTH = 120;
export const ITEM_DESCRIPTION_MAX_LENGTH = 2_000;
export const ITEM_TAG_MAX_LENGTH = 30;
export const ITEM_MAX_TAGS = 10;
export const ITEM_SEARCH_MAX_LENGTH = 100;
export const ITEM_ROUTES = {
  base: '/items',
  byId: '/:id',
  archive: '/:id/archive',
  restore: '/:id/restore',
} as const;
export const ITEM_AUDIT = {
  entityType: 'item',
  actions: { archive: 'ITEM_ARCHIVE', restore: 'ITEM_RESTORE' },
} as const;
/** Socket events of the sample feature (docs/BUSINESS_DOMAIN.md §7). */
export const ITEM_SOCKET_EVENTS = { created: 'item.created', updated: 'item.updated' } as const;
