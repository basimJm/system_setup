import type { Model } from 'mongoose';
import type { UploadStatus } from '../constants/uploads';
import { UploadModel, type UploadRaw } from '../models/upload.model';
import { toEntity, type Entity } from '../utils/database/plain';
import { BaseRepository } from './base.repository';

export class UploadsRepository extends BaseRepository<UploadRaw> {
  constructor(model: Model<UploadRaw> = UploadModel) {
    super(model);
  }

  findByKey(key: string): Promise<Entity<UploadRaw> | null> {
    return this.findOne({ key });
  }

  findByKeys(keys: readonly string[]): Promise<Entity<UploadRaw>[]> {
    return this.findMany({ key: { $in: [...keys] } });
  }

  /** Atomic status change: only an upload that is still `from` moves (two confirms cannot both win). */
  async transition(
    key: string,
    from: UploadStatus,
    to: UploadStatus,
  ): Promise<Entity<UploadRaw> | null> {
    const updated = await this.model
      .findOneAndUpdate(
        { key, status: from },
        { $set: { status: to } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    return updated === null ? null : toEntity<UploadRaw>(updated);
  }
}
