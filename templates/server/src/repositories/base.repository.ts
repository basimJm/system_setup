import type { Model, QueryFilter, UpdateQuery } from 'mongoose';
import { DEFAULT_SORT } from '../constants/database';
import { isObjectIdString } from '../utils/database/ids';
import {
  buildPaginationMeta,
  toSkipLimit,
  type PaginationMeta,
  type PaginationParams,
} from '../utils/pagination';
import { toEntity, type Entity } from '../utils/database/plain';

export type SortSpec = Readonly<Record<string, 1 | -1>>;

export interface Page<T> {
  readonly items: T[];
  readonly meta: PaginationMeta;
}

/** Fields to change; `undefined` means "leave as is". */
export type Patch<TRaw> = { [K in keyof TRaw]?: TRaw[K] | undefined };

export const isValidId = (id: string): boolean => isObjectIdString(id);

/**
 * Typed data access shared by all repositories (CLAUDE.md §2: the only code that queries
 * MongoDB). Returns plain entities (string ids), never Mongoose documents; "not found" is `null`,
 * the service decides what that means. Soft deletion uses each collection's own status field
 * (BUSINESS_DOMAIN.md), so there is no generic delete: override `baseFilter` to hide archived
 * records from every read and write.
 */
export abstract class BaseRepository<TRaw extends object> {
  protected constructor(protected readonly model: Model<TRaw>) {}

  /** Conditions added to every query, e.g. `{ status: { $ne: 'DELETED' } }`. */
  protected baseFilter(): QueryFilter<TRaw> {
    return {};
  }

  private scoped(filter: QueryFilter<TRaw> = {}): QueryFilter<TRaw> {
    return { $and: [this.baseFilter(), filter] };
  }

  async create(data: Partial<TRaw>): Promise<Entity<TRaw>> {
    const created = await this.model.create(data as never);
    return toEntity<TRaw>(created.toObject());
  }

  async findById(id: string): Promise<Entity<TRaw> | null> {
    if (!isValidId(id)) return null;
    return this.findOne({ _id: id });
  }

  async findOne(filter: QueryFilter<TRaw>): Promise<Entity<TRaw> | null> {
    const found = await this.model.findOne(this.scoped(filter)).lean().exec();
    return found === null ? null : toEntity<TRaw>(found);
  }

  async findMany(
    filter: QueryFilter<TRaw> = {},
    sort: SortSpec = DEFAULT_SORT,
  ): Promise<Entity<TRaw>[]> {
    const found = await this.model
      .find(this.scoped(filter))
      .sort({ ...sort, _id: 1 })
      .lean()
      .exec();
    return found.map((document) => toEntity<TRaw>(document));
  }

  /** One page plus the total count; ordering is made stable with `_id` as the last sort key. */
  async findPage(
    filter: QueryFilter<TRaw>,
    params: PaginationParams,
    sort: SortSpec = DEFAULT_SORT,
  ): Promise<Page<Entity<TRaw>>> {
    const scoped = this.scoped(filter);
    const { skip, limit } = toSkipLimit(params);
    const [found, total] = await Promise.all([
      this.model
        .find(scoped)
        .sort({ ...sort, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(scoped).exec(),
    ]);
    return {
      items: found.map((document) => toEntity<TRaw>(document)),
      meta: buildPaginationMeta(params, total),
    };
  }

  /**
   * Creates the record only when none matches `naturalKey`; an existing one is returned untouched,
   * so seeds can run again without overwriting what an admin changed.
   */
  async insertIfMissing(
    naturalKey: QueryFilter<TRaw>,
    data: Partial<TRaw>,
  ): Promise<{ entity: Entity<TRaw>; created: boolean }> {
    const existing = await this.findOne(naturalKey);
    if (existing !== null) return { entity: existing, created: false };
    return { entity: await this.create(data), created: true };
  }

  count(filter: QueryFilter<TRaw> = {}): Promise<number> {
    return this.model.countDocuments(this.scoped(filter)).exec();
  }

  /** Σ of one numeric field over the matching records (0 when none). */
  async sumField(filter: QueryFilter<TRaw>, field: string): Promise<number> {
    const [row] = await this.model
      .aggregate<{ sum: number }>([
        { $match: this.scoped(filter) },
        { $group: { _id: null, sum: { $sum: `$${field}` } } },
      ])
      .exec();
    return row?.sum ?? 0;
  }

  /** How many matching records have each value of `field`. */
  async countBy(filter: QueryFilter<TRaw>, field: string): Promise<Record<string, number>> {
    const rows = await this.model
      .aggregate<{ _id: string; count: number }>([
        { $match: this.scoped(filter) },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      ])
      .exec();
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  async exists(filter: QueryFilter<TRaw>): Promise<boolean> {
    return (await this.model.exists(this.scoped(filter)).exec()) !== null;
  }

  /** `$set` of the given fields (undefined values are ignored); returns the updated entity or null. */
  async updateById(id: string, patch: Patch<TRaw>): Promise<Entity<TRaw> | null> {
    if (!isValidId(id)) return null;
    const fields = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    const updated = await this.model
      .findOneAndUpdate(this.scoped({ _id: id }), { $set: fields } as UpdateQuery<TRaw>, {
        returnDocument: 'after',
        runValidators: true,
      })
      .lean()
      .exec();
    return updated === null ? null : toEntity<TRaw>(updated);
  }
}
