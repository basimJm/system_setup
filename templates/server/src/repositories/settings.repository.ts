import type { Model } from 'mongoose';
import { SettingModel, type SettingRaw } from '../models/setting.model';
import { isDuplicateKeyError } from '../utils/database/errors';
import { toEntity, type Entity } from '../utils/database/plain';
import { BaseRepository } from './base.repository';

export class SettingsRepository extends BaseRepository<SettingRaw> {
  constructor(model: Model<SettingRaw> = SettingModel) {
    super(model);
  }

  /** Every stored override. The collection is tiny (one document per changed key). */
  findAllEntries(): Promise<Entity<SettingRaw>[]> {
    return this.findMany({});
  }

  /** Sets a key, creating it on first use. Safe to call concurrently for the same key. */
  async upsert(key: string, value: unknown): Promise<Entity<SettingRaw>> {
    try {
      return await this.upsertOnce(key, value);
    } catch (error) {
      // Two first-time upserts of one key can race: the loser hits the unique index. The key
      // exists by now, so a second attempt is a plain update.
      if (!isDuplicateKeyError(error)) throw error;
      return this.upsertOnce(key, value);
    }
  }

  private async upsertOnce(key: string, value: unknown): Promise<Entity<SettingRaw>> {
    const saved = await this.model
      .findOneAndUpdate(
        { key },
        { $set: { value } },
        { upsert: true, returnDocument: 'after', runValidators: true },
      )
      .lean()
      .exec();
    return toEntity<SettingRaw>(saved);
  }
}
