/** Domain enums shared by every namespace (see docs/BUSINESS_DOMAIN.md §1). Each feature adds the ones it needs. */

/** Who performed an action. */
export const ACTOR_TYPES = ['CUSTOMER', 'MEMBER', 'ADMIN', 'SYSTEM'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Client platform. */
export const PLATFORMS = ['ANDROID', 'IOS', 'WEB'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Languages of the apps and notifications. */
export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const CUSTOMER_STATUSES = ['ACTIVE', 'BLOCKED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/** The OWNER opened the merchant account; STAFF members are added by the owner. */
export const MEMBER_ROLES = ['OWNER', 'STAFF'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Per-feature permissions an owner grants to staff. The owner always has all of them. */
export const PERMISSIONS = ['ITEMS_VIEW', 'ITEMS_MANAGE'] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Who a session (refresh token) belongs to. */
export const SUBJECT_TYPES = ['CUSTOMER', 'MEMBER', 'ADMIN'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

/** In-app notifications. */
export const NOTIFICATION_TYPES = ['ITEM', 'SYSTEM'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_RECIPIENT_TYPES = ['CUSTOMER', 'MEMBER'] as const;
export type NotificationRecipientType = (typeof NOTIFICATION_RECIPIENT_TYPES)[number];

/** Who owns an item: a customer, or a merchant account (every member of that tenant). */
export const ITEM_OWNER_TYPES = ['CUSTOMER', 'MERCHANT'] as const;
export type ItemOwnerType = (typeof ITEM_OWNER_TYPES)[number];
export const ITEM_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
