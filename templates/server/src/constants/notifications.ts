import type { NotificationType } from './enums';

/** Notification core (docs/BUSINESS_DOMAIN.md §3.6 `notifications`, §8). */
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const NOTIFICATION_TITLE_MAX_LENGTH = 200;
export const NOTIFICATION_BODY_MAX_LENGTH = 1000;

/** Outcome stored in `pushResult`. */
export const PUSH_RESULTS = {
  sent: 'SENT',
  noToken: 'NO_TOKEN',
  failed: 'FAILED',
} as const;

/** Every event with its type; the template key is `notifications.<event>.title|body`. */
export const NOTIFICATION_EVENTS = {
  'item.archived_by_admin': { type: 'ITEM' },
  'item.restored_by_admin': { type: 'ITEM' },
  'account.welcome': { type: 'SYSTEM' },
} as const satisfies Record<string, { readonly type: NotificationType }>;
export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

export const NOTIFICATION_ROUTES = {
  base: '/notifications',
  unreadCount: '/unread-count',
  read: '/read',
} as const;
export const MAX_READ_IDS = 100;
export const INBOX_SEARCH_MAX_LENGTH = 100;
export const NOTIFICATION_DEEP_LINK_MAX_LENGTH = 500;
