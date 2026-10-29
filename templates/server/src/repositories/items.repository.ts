import type { Model } from 'mongoose';
import type { ItemOwnerType, ItemStatus } from '../constants/enums';
import { ItemModel, type ItemRaw } from '../models/item.model';
import { toObjectId } from '../utils/database/ids';
import type { PaginationParams } from '../utils/pagination';
import { BaseRepository, type Page } from './base.repository';
import type { Entity } from '../utils/database/plain';

export interface ItemFilter {
  readonly ownerType?: ItemOwnerType | undefined;
  readonly ownerId?: string | undefined;
  readonly status?: ItemStatus | undefined;
  readonly tag?: string | undefined;
  /** Case-insensitive title search. */
  readonly q?: string | undefined;
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class ItemsRepository extends BaseRepository<ItemRaw> {
  constructor(model: Model<ItemRaw> = ItemModel) {
    super(model);
  }

  findPageBy(filter: ItemFilter, params: PaginationParams): Promise<Page<Entity<ItemRaw>>> {
    const text = filter.q?.trim();
    return this.findPage(
      {
        ...(filter.ownerType === undefined ? {} : { ownerType: filter.ownerType }),
        ...(filter.ownerId === undefined ? {} : { ownerId: toObjectId(filter.ownerId) }),
        ...(filter.status === undefined ? {} : { status: filter.status }),
        ...(filter.tag === undefined ? {} : { tags: filter.tag }),
        ...(text === undefined || text === ''
          ? {}
          : { title: { $regex: escapeRegex(text), $options: 'i' } }),
      },
      params,
    );
  }

  countActive(ownerType: ItemOwnerType, ownerId: string): Promise<number> {
    return this.count({ ownerType, ownerId: toObjectId(ownerId), status: 'ACTIVE' });
  }
}
