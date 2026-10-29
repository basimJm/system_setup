import type { Language, NotificationRecipientType } from '../../constants/enums';
import type { NotificationRaw } from '../../models/notification.model';
import type { NotificationsRepository } from '../../repositories/notifications.repository';
import type { Entity } from '../../utils/database/plain';
import { toObjectId } from '../../utils/database/ids';
import type { PaginationMeta, PaginationParams } from '../../utils/pagination';
import { localDayRange } from '../../utils/time';
import type { AccessEvents } from '../access/accessEvents';
import type { SettingsService } from '../settings';

export interface InboxAccount {
  readonly recipientType: NotificationRecipientType;
  readonly id: string;
}

export interface InboxFilter {
  /** Civil dates in the business time zone, both ends included. */
  readonly from?: string;
  readonly to?: string;
  readonly q?: string;
  readonly unreadOnly?: boolean;
}

export interface InboxItem {
  readonly id: string;
  readonly type: string;
  readonly event: string;
  readonly title: string;
  readonly body: string;
  readonly data: NotificationRaw['data'];
  readonly isRead: boolean;
  readonly createdAt: Date;
}

export interface InboxService {
  list(input: {
    account: InboxAccount;
    language: Language;
    filter: InboxFilter;
    params: PaginationParams;
  }): Promise<{ items: InboxItem[]; meta: PaginationMeta }>;
  unreadCount(account: InboxAccount): Promise<number>;
  /** Marks own notifications read (repeat and foreign ids are harmless); returns the new unread count. */
  markRead(
    account: InboxAccount,
    ids: readonly string[],
  ): Promise<{ marked: number; unread: number }>;
}

export interface InboxDeps {
  readonly notifications: Pick<NotificationsRepository, 'findPage' | 'countUnread' | 'markRead'>;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly access: Pick<AccessEvents, 'unreadChanged'>;
  readonly now?: () => Date;
}

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createInboxService = (deps: InboxDeps): InboxService => {
  const { notifications, settings, access, now = () => new Date() } = deps;
  const toItem = (row: Entity<NotificationRaw>, language: Language): InboxItem => ({
    id: row.id,
    type: row.type,
    event: row.event,
    title: row.title[language],
    body: row.body[language],
    data: row.data,
    isRead: row.readAt !== undefined,
    createdAt: row.createdAt,
  });

  return {
    async list({ account, language, filter, params }) {
      const timeZone = await settings.get('timezone');
      const created: { $gte?: Date; $lt?: Date } = {};
      if (filter.from !== undefined) created.$gte = localDayRange(filter.from, timeZone).start;
      if (filter.to !== undefined) created.$lt = localDayRange(filter.to, timeZone).end;
      const text = filter.q?.trim();
      const page = await notifications.findPage(
        {
          recipientType: account.recipientType,
          recipientId: toObjectId(account.id),
          ...(created.$gte === undefined && created.$lt === undefined
            ? {}
            : { createdAt: created }),
          ...(filter.unreadOnly === true ? { readAt: { $exists: false } } : {}),
          ...(text === undefined || text === ''
            ? {}
            : {
                $or: [
                  { [`title.${language}`]: { $regex: escapeRegex(text), $options: 'i' } },
                  { [`body.${language}`]: { $regex: escapeRegex(text), $options: 'i' } },
                ],
              }),
        },
        params,
        { createdAt: -1 },
      );
      return { items: page.items.map((row) => toItem(row, language)), meta: page.meta };
    },

    unreadCount: (account) => notifications.countUnread(account.recipientType, account.id),

    async markRead(account, ids) {
      const marked = await notifications.markRead(
        account.recipientType,
        account.id,
        [...new Set(ids)],
        now(),
      );
      const unread = await notifications.countUnread(account.recipientType, account.id);
      // Other open devices of the same account update their badge too.
      if (marked > 0) {
        await access.unreadChanged(
          { scope: account.recipientType === 'CUSTOMER' ? 'customer' : 'merchant', id: account.id },
          unread,
        );
      }
      return { marked, unread };
    },
  };
};
