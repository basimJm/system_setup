import type { Model, QueryFilter } from 'mongoose';
import { DEFAULT_SORT } from '../constants/database';
import { buildPaginationMeta, toSkipLimit, type PaginationParams } from '../utils/pagination';
import { toEntity, type Entity } from '../utils/database/plain';
import { isValidId, type Page, type SortSpec } from './base.repository';

/**
 * Data access for collections that are only ever added to (audit log, server events). It offers
 * `append` and reads and, on purpose, no update or delete method; the model refuses them too.
 */
export abstract class AppendOnlyRepository<TRaw extends object> {
  protected constructor(protected readonly model: Model<TRaw>) {}

  async append(data: Partial<TRaw>): Promise<Entity<TRaw>> {
    const created = await this.model.create(data as never);
    return toEntity<TRaw>(created.toObject());
  }

  async findById(id: string): Promise<Entity<TRaw> | null> {
    if (!isValidId(id)) return null;
    const found = await this.model
      .findOne({ _id: id } as QueryFilter<TRaw>)
      .lean()
      .exec();
    return found === null ? null : toEntity<TRaw>(found);
  }

  /** One page, newest first by default, with a stable `_id` tie-break. */
  async findPage(
    filter: QueryFilter<TRaw>,
    params: PaginationParams,
    sort: SortSpec = DEFAULT_SORT,
  ): Promise<Page<Entity<TRaw>>> {
    const { skip, limit } = toSkipLimit(params);
    const [found, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ ...sort, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return {
      items: found.map((document) => toEntity<TRaw>(document)),
      meta: buildPaginationMeta(params, total),
    };
  }
}
