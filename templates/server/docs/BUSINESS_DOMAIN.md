# **SYSTEM_NAME** — Business Domain (single source for schemas, enums, rules, permissions, jobs, settings and error codes)

> Every server schema, enum, state machine, permission, job, setting and error code comes from here. Fill the sections as the product is defined; the scaffold documents what the template ships.

## 1. Enums

`ActorType` CUSTOMER | MEMBER | ADMIN | SYSTEM · `Platform` ANDROID | IOS | WEB · `Language` ar | en · `CustomerStatus` ACTIVE | BLOCKED · `MemberRole` OWNER | STAFF · `Permission` ITEMS_VIEW | ITEMS_MANAGE · `SubjectType` CUSTOMER | MEMBER | ADMIN · `NotificationType` ITEM | SYSTEM · `ItemOwnerType` CUSTOMER | MERCHANT · `ItemStatus` ACTIVE | ARCHIVED (`src/constants/enums.ts`).

## 2. Languages and time

Arabic default, English second; every message in both. Instants stored in UTC; business dates computed in `settings.timezone` (default `UTC`).

## 3. Collections

- §3.1 `customers` (phone E.164 unique, name, email?, language, pushToken?, status), `admins` (email unique, bcrypt hash, lockout fields), `refreshTokens` (SHA-256 hash, family, revocation).
- §3.1a Phone OTP: server-generated code, HMAC at rest in Redis (`otp:code:{purpose}:{e164}`), single use, signed single-use `otpToken` (`otp:used:{jti}`); limits `otp.*` in §10.
- §3.4 `members` (tenantId, businessName, name, phone unique, role, permissions, active, language, pushToken?); exactly one OWNER per tenant.
- §3.6 `notifications` (recipient, type, event, `{ar,en}` title/body, data, readAt, push result, dedupeKey unique per recipient).
- §3.7 `settings` (key/value overrides), `auditLogs` (append-only), `serverEvents` (append-only), `uploads` (key, purpose, owner, status PENDING | CONFIRMED | REJECTED, TTL on pending).
- §3.8 `items` (sample): ownerType, ownerId, title, description?, tags, imageKey?, status, archivedReason?.

## 4–5. Rules and state machines

- Item: ACTIVE → ARCHIVED (owner or admin), ARCHIVED → ACTIVE (admin restore). Archived items are read-only for the owner. At most `items.maxPerOwner` active items.
- Uploads: presign (policy by purpose: scopes, permission, owner-only, kind, visibility) → direct PUT → confirm (real type and size checked; wrong files deleted).

## 6. Permissions

The OWNER has every permission and the owner-only capabilities (`TEAM_MANAGE`). STAFF hold a grant from `Permission`; a change applies at once (`loadMember` per request, `permissions.updated` socket event); deactivation revokes every session.

## 7. Real-time

Rooms `customer:{id}`, `member:{id}`, `tenant:{tenantId}`, `admin`. Events: `item.created`, `item.updated`, `notifications.unread`, `permissions.updated`, `access.revoked`, `overview.tick`.

## 8. Notifications

In-app record first (both languages), push in the recipient's saved language, badge update. Events: `account.welcome`, `item.archived_by_admin`, `item.restored_by_admin`.

## 9. Jobs

`periodic.notifications-purge` (03:00, deletes read notifications older than `notifications.retentionDays`), `periodic.overview-tick` (every minute).

## 10. Settings (defaults in `src/constants/settings.ts`)

`timezone`, `otp.length` 6, `otp.resendAfterSec` 60, `otp.maxRequests` 5 / `otp.requestWindowSec` 300, `otp.maxWrong` 5, `otp.blockSec` 900, `otp.codeTtlSec` 300, `otp.proofTtlSec` 600, `auth.accessTokenTtlSec` 900, `auth.refreshTokenTtlDays` 90, `admin.maxFailedLogins` 5, `admin.lockSec` 900, `admin.sessionIdleSec` 172800, `pagination.appPageSize` 10, `pagination.adminPageSize` 25, `uploads.imageMaxMb` 10, `uploads.docMaxMb` 10, `notifications.retentionDays` 90, `items.maxPerOwner` 100.

## 11. Error codes

`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `PERMISSION_DENIED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`, `OTP_BLOCKED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_DELIVERY_FAILED`, `PHONE_NOT_REGISTERED`, `PHONE_ALREADY_REGISTERED`, `ACCOUNT_BLOCKED`, `MEMBER_INACTIVE`, `OWNER_REQUIRED`, `PAYMENT_FAILED`, `UPLOAD_INVALID`, `UPLOAD_TOO_LARGE`, `ITEM_NOT_FOUND`, `ITEM_ARCHIVED`, `ITEM_LIMIT_REACHED`.
