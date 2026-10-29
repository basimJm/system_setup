import type { ApiClient } from '@/data/api/ApiClient';
import { defineEndpoint } from '@/data/api/endpoint';
import { defined } from '@/data/api/resource';
import * as dto from '@/data/contract/generated/dto';
import { OPERATIONS } from '@/data/contract/generated/operations';
import type { Item, ItemsRepository } from '@/domain/items/items';

const list = defineEndpoint(OPERATIONS.getItems, {
  data: dto.getItemsDataSchema,
  query: dto.getItemsQuerySchema,
});
const get = defineEndpoint(OPERATIONS.getItemsById, { data: dto.getItemsByIdDataSchema });
const archive = defineEndpoint(OPERATIONS.postItemsByIdArchive, {
  data: dto.postItemsByIdArchiveDataSchema,
  body: dto.postItemsByIdArchiveBodySchema,
});
const restore = defineEndpoint(OPERATIONS.postItemsByIdRestore, {
  data: dto.postItemsByIdRestoreDataSchema,
  body: dto.postItemsByIdRestoreBodySchema,
});

/** The contract's `AdminItem` -> the domain record (optional fields become explicit nulls). */
export const toItem = (row: dto.getItemsData[number]): Item => ({
  id: row.id,
  title: row.title,
  description: row.description ?? null,
  tags: row.tags,
  imageUrl: row.imageUrl,
  status: row.status,
  owner: row.owner,
  archivedReason: row.archivedReason ?? null,
  archivedAt: row.archivedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** `/admin/v1/items`: the generated schemas check every query, body and answer against the contract. */
export class RemoteItemsRepository implements ItemsRepository {
  constructor(private readonly api: ApiClient) {}

  list: ItemsRepository['list'] = async (q) => {
    const page = await this.api.executePage(list, {
      query: defined({
        page: q.page,
        pageSize: q.pageSize,
        q: q.q,
        status: q.status,
        ownerType: q.ownerType,
        ownerId: q.ownerId,
        tag: q.tag,
      }),
    });
    return { ...page, items: page.items.map(toItem) };
  };

  get: ItemsRepository['get'] = async (id) =>
    toItem((await this.api.execute(get, { params: { id } })).data);

  archive: ItemsRepository['archive'] = async (id, reason) =>
    toItem((await this.api.execute(archive, { params: { id }, body: { reason } })).data);

  restore: ItemsRepository['restore'] = async (id, reason) =>
    toItem((await this.api.execute(restore, { params: { id }, body: { reason } })).data);
}
