import type { Language, NotificationRecipientType } from '../../constants/enums';
import {
  NOTIFICATION_EVENTS,
  PUSH_RESULTS,
  type NotificationEvent,
} from '../../constants/notifications';
import { LANGUAGES } from '../../constants/i18n';
import type { NotificationData, NotificationRaw } from '../../models/notification.model';
import type { Notifier, PushRequest } from '../../providers/notifier';
import type { NotificationsRepository } from '../../repositories/notifications.repository';
import { isDuplicateKeyError } from '../../utils/database/errors';
import { toObjectId } from '../../utils/database/ids';
import type { Entity } from '../../utils/database/plain';
import { translate } from '../../utils/i18n';
import type { Logger } from '../../utils/logger';
import type { MessageParams } from '../../utils/errors';
import type { AccessEvents } from '../access/accessEvents';

/** Who receives a notification and how to reach their device. */
export interface Recipient {
  readonly type: NotificationRecipientType;
  readonly id: string;
  readonly language: Language;
  readonly pushToken?: string | undefined;
}

/** Looks a recipient up (customers and members repositories implement it). */
export interface RecipientSource {
  findRecipient(type: NotificationRecipientType, id: string): Promise<Recipient | null>;
}

export interface NotifyInput {
  readonly recipient: { readonly type: NotificationRecipientType; readonly id: string };
  readonly event: NotificationEvent;
  /** Placeholders of the `notifications.<event>.title|body` templates. */
  readonly params?: MessageParams;
  readonly data?: NotificationData;
  /** One logical notification per recipient: a retry with the same key stores nothing new. */
  readonly dedupeKey: string;
}

export interface NotificationService {
  /** Stores the in-app copy (both languages), pushes to the device, bumps the unread badge. Never throws. */
  notify(input: NotifyInput): Promise<Entity<NotificationRaw> | null>;
  unreadCount(type: NotificationRecipientType, id: string): Promise<number>;
}

export interface NotificationServiceDeps {
  readonly notifications: NotificationsRepository;
  readonly recipients: RecipientSource;
  readonly notifier: Pick<Notifier, 'sendPush'>;
  readonly access: Pick<AccessEvents, 'unreadChanged'>;
  readonly logger: Logger;
}

const scopeOf = (type: NotificationRecipientType): 'customer' | 'merchant' =>
  type === 'CUSTOMER' ? 'customer' : 'merchant';

/**
 * Notification core (docs/BUSINESS_DOMAIN.md §8): the in-app record is the source of truth; the
 * push is a localized copy in the recipient's saved language, never the request language.
 */
export const createNotificationService = (deps: NotificationServiceDeps): NotificationService => {
  const { notifications, recipients, notifier, access, logger } = deps;

  const text = (
    event: NotificationEvent,
    part: 'title' | 'body',
    params?: MessageParams,
  ): Record<Language, string> =>
    Object.fromEntries(
      LANGUAGES.map((language) => [
        language,
        translate(language, `notifications.${event}.${part}`, params),
      ]),
    ) as Record<Language, string>;

  const push = async (recipient: Recipient, stored: Entity<NotificationRaw>): Promise<void> => {
    if (recipient.pushToken === undefined) {
      await notifications.recordPush(stored.id, false, PUSH_RESULTS.noToken);
      return;
    }
    const request: PushRequest = {
      target: { tokens: [recipient.pushToken] },
      message: {
        app: recipient.type === 'CUSTOMER' ? 'CUSTOMER' : 'MERCHANT',
        kind: 'VISIBLE',
        title: stored.title[recipient.language],
        body: stored.body[recipient.language],
        data: {
          notificationId: stored.id,
          event: stored.event,
          ...Object.fromEntries(
            Object.entries(stored.data).filter(([, v]) => typeof v === 'string'),
          ),
        },
      },
      idempotencyKey: `notification:${stored.id}`,
    };
    try {
      const result = await notifier.sendPush(request);
      await notifications.recordPush(
        stored.id,
        result.sent > 0,
        result.sent > 0 ? PUSH_RESULTS.sent : PUSH_RESULTS.failed,
      );
    } catch (error) {
      logger.warn({ err: error, notificationId: stored.id }, 'push failed');
      await notifications.recordPush(stored.id, false, PUSH_RESULTS.failed);
    }
  };

  return {
    async notify(input) {
      try {
        const recipient = await recipients.findRecipient(input.recipient.type, input.recipient.id);
        if (recipient === null) return null;
        let stored: Entity<NotificationRaw>;
        try {
          stored = await notifications.create({
            recipientType: recipient.type,
            recipientId: toObjectId(recipient.id),
            type: NOTIFICATION_EVENTS[input.event].type,
            event: input.event,
            title: text(input.event, 'title', input.params),
            body: text(input.event, 'body', input.params),
            data: input.data ?? {},
            pushSent: false,
            dedupeKey: input.dedupeKey,
          });
        } catch (error) {
          // Already delivered for this key (a retried job): nothing more to do.
          if (isDuplicateKeyError(error)) return null;
          throw error;
        }
        await push(recipient, stored);
        const unread = await notifications.countUnread(recipient.type, recipient.id);
        await access.unreadChanged({ scope: scopeOf(recipient.type), id: recipient.id }, unread);
        return stored;
      } catch (error) {
        // A notification must never undo the change that triggered it.
        logger.error({ err: error, event: input.event }, 'notification failed');
        return null;
      }
    },

    unreadCount: (type, id) => notifications.countUnread(type, id),
  };
};
