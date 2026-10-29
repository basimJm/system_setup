# __SYSTEM_NAME__ — Business Domain Specification (single source for server schemas & business logic)

> Mandatory reading **by section** for server, contract and cross-project tasks (grep the heading, read the range). PRDs describe screens; this file describes the data and the rules every project must agree on. Precedence: PRD > BRD > this file for behaviour; this file wins for schemas, enums, error codes and settings keys. Created __DATE__.
>
> Conventions: money = integer minor units (never floats); timestamps stored in UTC, business dates/hours computed in the system time zone from settings; ids are opaque strings; every enum lives here once and is mirrored (never re-typed) in the generated contract and the clients' tests.

## 1. Actors & Identities
<!-- one row per actor: who they are, how they authenticate (namespace/scope), what identifies them (phone/email), what they own -->
| Actor | Namespace / scope | Identity | Owns |
|---|---|---|---|

## 2. Enums (shared by server, contracts and clients)
<!-- `EnumName`: VALUE_A, VALUE_B — meaning. Clients' tests compare their status/label tables against the contract's query enums. -->

## 3. Collections
<!-- one sub-section per aggregate: fields (type, required, default), indexes, soft-delete/`status` semantics, snapshot fields. Append-only collections marked as such. -->
### 3.1 Identity & sessions
### 3.2 Reference data
### 3.3 Core aggregates
### 3.4 Operations (audit log, notifications, jobs)

## 4. Relationships (summary)
<!-- who references whom; which deletes cascade, which are forbidden while children exist -->

## 5. Computed Rules
<!-- numbered, each testable; tasks cite "§5.N". Typical: time arithmetic, completeness → state, availability, pricing/rounding (half-up ties away from zero in minor units), atomic creation with locks, cancellation/refund policies, ratings, conflicts on schedule changes, subscriptions, deletion grace period. -->
### 5.1 Time
### 5.2 Completeness → visibility state
### 5.3 Availability
### 5.4 Pricing & amounts
### 5.5 Atomic creation (locks + re-validation)
### 5.6 State machine
```
<!-- states and allowed transitions with the actor allowed to make each; terminal states; who may force-complete -->
```
### 5.7 Cancellation & refunds
### 5.8 Account deletion

## 6. Permissions Matrix
<!-- grantable keys × endpoints/socket events/notifications; the owner role has all -->

## 7. Real-time Events
<!-- event name → room(s) → payload summary → which client query it invalidates -->

## 8. Notifications (events → recipients)
<!-- event → recipients (by role/permission) → channel (push/email/in-app) → template keys (AR/EN) -->

## 9. Scheduled Jobs
<!-- job → trigger/schedule → deterministic id → effect → idempotency note -->

## 10. Settings (keys & defaults; admin-editable)
<!-- `group.key` → type → default → who reads it. Limits, windows, percentages, time zone, lengths all live here, never in code. -->

## 11. Error Codes (API `code` field)
<!-- CODE → HTTP status → when → client behaviour. Every code has an AR+EN message in the server locales and in each client; tests enforce parity. -->
The server's `src/constants/errorCodes.ts` and this block are the same list; the admin (`tests/errorCatalog.test.ts`) and the apps
(`scripts/ci/policy/error_codes.py`) read the fenced block below, so a new code is added here first, with its status and the behaviour clients apply.

```
Code                      Status  Meaning / client behaviour
VALIDATION_ERROR          400     a field of the request is invalid; `details[]` names the fields -> show the field errors
UNAUTHORIZED              401     missing, expired or wrong credentials or token -> sign in again
FORBIDDEN                 403     the token's scope cannot use this namespace -> leave the screen; contact support
PERMISSION_DENIED         403     the member lacks the permission key for this action -> hide or explain the action
NOT_FOUND                 404     the record does not exist or is not visible -> back to the list
CONFLICT                  409     the action conflicts with the current state (duplicate, stale version) -> reload and retry
RATE_LIMITED              429     too many requests from this client -> wait, then retry
INTERNAL                  500     unexpected server failure (502/503 when a dependency is down) -> retry later; report the trace id
OTP_BLOCKED               429     too many wrong codes or requests; verification blocked for a while -> wait for the block to lift
OTP_INVALID               401     the verification code is wrong -> let the user retype it
OTP_EXPIRED               401     the verification code or its token expired -> request a new code
OTP_DELIVERY_FAILED       422     the code could not be delivered to the phone -> offer to resend
PHONE_NOT_REGISTERED      404     login with a phone that has no account -> offer registration
PHONE_ALREADY_REGISTERED  409     registration or phone change with a phone already in use -> offer login
ACCOUNT_BLOCKED           403     the account is blocked by admin -> sign out; contact support
MEMBER_INACTIVE           403     the merchant member is inactive -> sign out; contact the owner
OWNER_REQUIRED            403     only the owner may do this (or grant this permission) -> hide the action
PAYMENT_FAILED            402     the gateway refused or failed the payment; nothing was created -> let the user retry or change the method
UPLOAD_INVALID            400     content type, size or key of an upload is not acceptable -> pick another file
UPLOAD_TOO_LARGE          400     the file exceeds the limit for its purpose -> compress or pick a smaller file
ITEM_NOT_FOUND            404     the item does not exist or belongs to someone else -> back to the list
ITEM_ARCHIVED             422     the item is archived; the action needs an active item -> restore it first (admin) or refresh
ITEM_LIMIT_REACHED        422     the owner reached the maximum number of items -> archive one first
```

## 12. Open Points (assumptions in use — confirm or change)
<!-- numbered owner questions with the assumption currently implemented; when the owner answers, move the answer into the section it belongs to and record the date -->
