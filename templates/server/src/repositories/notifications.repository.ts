import type { Model } from 'mongoose';
import type { NotificationRecipientType } from '../constants/enums';
import { NotificationModel, type NotificationRaw } from '../models/notification.model';
import { isObjectIdString, toObjectId } from '../utils/database/ids';
import { BaseRepository } from './base.repository';

export class NotificationsRepository extends BaseRepository<NotificationRaw> {
  constructor(model: Model<NotificationRaw> = NotificationModel) {
    super(model);
  }

  /** Unread notifications of one account (the bell badge). */
  countUnread(recipientType: NotificationRecipientType, recipientId: string): Promise<number> {
    if (!isObjectIdString(recipientId)) return Promise.resolve(0);
    return this.model
      .countDocuments({ recipientType, recipientId, readAt: { $exists: false } })
      .exec();
  }

  /** Remembers how the push went (the in-app copy is stored before the push is attempted). */
  async recordPush(id: string, pushSent: boolean, pushResult: string): Promise<void> {
    if (!isObjectIdString(id)) return;
    await this.model.findOneAndUpdate({ _id: id }, { $set: { pushSent, pushResult } }).exec();
  }

  /** Marks the account's own unread notifications among `ids` as read; returns how many changed. */
  async markRead(
    recipientType: NotificationRecipientType,
    recipientId: string,
    ids: readonly string[],
    at: Date,
  ): Promise<number> {
    const valid = ids.filter((id) => isObjectIdString(id)).map((id) => toObjectId(id));
    if (valid.length === 0 || !isObjectIdString(recipientId)) return 0;
    const result = await this.model
      .updateMany(
        {
          recipientType,
          recipientId: toObjectId(recipientId),
          _id: { $in: valid },
          readAt: { $exists: false },
        },
        { $set: { readAt: at } },
      )
      .exec();
    return result.modifiedCount;
  }

  /** Deletes notifications read before `before` (retention); returns how many went. */
  async deleteReadBefore(before: Date): Promise<number> {
    const result = await this.model.deleteMany({ readAt: { $lt: before } }).exec();
    return result.deletedCount;
  }
}
