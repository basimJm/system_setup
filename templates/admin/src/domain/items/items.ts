import type { Page, PageQuery } from '@/domain/shared/page';

/** The sample resource of the template: a user-owned record the admin can archive and restore with a reason. */
export const ITEM_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const ITEM_OWNER_TYPES = ['CUSTOMER', 'MERCHANT'] as const;
export type ItemOwnerType = (typeof ITEM_OWNER_TYPES)[number];

export interface ItemOwner {
  readonly type: ItemOwnerType;
  readonly id: string;
}
export interface Item {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly tags: readonly string[];
  readonly imageUrl: string | null;
  readonly status: ItemStatus;
  readonly owner: ItemOwner;
  /** Set while the item is archived (the reason the admin gave). */
  readonly archivedReason: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ItemsQuery extends PageQuery {
  q?: string;
  status?: ItemStatus;
  ownerType?: ItemOwnerType;
  ownerId?: string;
  tag?: string;
}

export interface ItemsRepository {
  list(query: ItemsQuery): Promise<Page<Item>>;
  get(id: string): Promise<Item>;
  /** Hides the item from its owner's audience; audited with the reason, the owner is notified. */
  archive(id: string, reason: string): Promise<Item>;
  /** Brings an archived item back; audited with the reason, the owner is notified. */
  restore(id: string, reason: string): Promise<Item>;
}

/** The one state change the admin can apply to an item (`POST /items/{id}/<transition>`). */
export const ITEM_TRANSITIONS = ['archive', 'restore'] as const;
export type ItemTransition = (typeof ITEM_TRANSITIONS)[number];

/** Which transition the item accepts now: active items archive, archived items restore. */
export const transitionOf = (item: Pick<Item, 'status'>): ItemTransition =>
  item.status === 'ARCHIVED' ? 'restore' : 'archive';

export const isItemStatus = (value: unknown): value is ItemStatus =>
  ITEM_STATUSES.some((s) => s === value);
export const isItemOwnerType = (value: unknown): value is ItemOwnerType =>
  ITEM_OWNER_TYPES.some((s) => s === value);

/** The entity type the server writes in audit rows for an item. */
export const ITEM_ENTITY_TYPE = 'ITEM';
