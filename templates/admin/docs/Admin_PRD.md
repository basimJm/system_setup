# __SYSTEM_NAME__ — Admin Panel PRD

> Behaviour source of truth for `__ADMIN_DIR__`. Precedence: PRD > BRD > Design Script > design files. When two documents disagree, stop and ask. Pages are numbered `P00…`; tasks in `docs/Admin_Tasks.md` reference them.

## 0. How to read this document

- One section per page (`P00` login, `P01` items list, …). A task row names the pages it touches; read only those.
- "Admin" = a signed-in operator of the panel. Every write names a reason and is recorded in the audit log.
- Wire format = the server's generated OpenAPI (`../__SERVER_DIR__/docs/api/openapi.admin.json`, synced with `npm run api:sync`), never this document.

## 1. Overview

The admin panel is the back office of __SYSTEM_NAME__ (`__SYSTEM_NAME_AR__`): a React 19 + TypeScript + Vite single-page app that talks to `/admin/v1` only. It ships with one business module (**items**, `P01`/`P02`) as the reference implementation; product modules replace or extend it (`docs/HOW_TO_ADD_A_MODULE.md`).

## 2. Technical constraints

- Arabic (RTL) is the default language, English (LTR) second; every string exists in both; numerals follow the language.
- Light and dark themes; phone, tablet and desktop, portrait and landscape; no horizontal page scroll.
- Times are stored in UTC and shown in the platform time zone (`src/constants/kernel.ts`), 12-hour clock. Money is a decimal string on the wire and integer minor units in the client.
- Four build variants (`dev|prod` × `debug|release`); `dev-debug` runs on the built-in mock data source.
- Performance: every route lazy, every list paginated on the server, gzip budgets in `scripts/budget.json`.

## 3. Global UI rules

- Shell: sidebar (collapsible rail on tablets, drawer on phones), top bar (language, theme, admin menu), breadcrumbs for sub-pages.
- Lists keep page, size, search, sort and filters in the URL. Each list card shows the server total, a search box when the API supports `q`, filter chips, and an Export menu (XLSX / CSV / PDF, design kit) when the server offers an export operation (none in the template).
- Every write asks for a **reason** (minimum length in `src/constants/ui.ts`); the server records it in the audit log.
- States: loading (skeleton), empty, error with retry, forbidden, not found, validation errors next to the field, server messages shown as sent.
- Realtime: the server emits `<entity>.updated` events on `/admin`; the panel invalidates the matching queries (`src/constants/realtime.ts`).

## 4. Authentication and security

- `P00` Login: email + password, then an emailed one-time code. Wrong code → localized error; the session lands on `HOME_ROUTE`.
- Access token in memory (mirrored to this tab's `sessionStorage` so a reload keeps the session), refresh token rotated by the server, idle timeout with a warning dialog, sign-out on 401.

## 5. Navigation

| Order | Module | Route | Page |
|---|---|---|---|
| 1 | Items | `/items` | P01, P02 |
| 2 | Settings | `/settings` | P05 |
| 3 | Audit log | `/audit-log` | P06 |

`src/constants/nav.ts` is the single source; a module with sub-pages lists them as `children`.

## 6. Pages

### P00 — Login and verification code
Two steps (credentials, code), resend countdown, masked e-mail on the second step, language and theme switches, brand panel.

### P01 — Items (sample module)
List of user-owned items: title (link to `P02`), owner type badge, tags, status badge, updated. Search by title, filter by status (owner type and tag filters in the URL), server pagination. The row action archives an active item or restores an archived one; both ask for a reason (`ReasonDialog`) and are audited; the owner is notified by the server.

### P02 — Item details
Header with status and **Archive** / **Restore**; tabs *Overview* (title, description, tags, owner, image, archive reason and date, timestamps, id) and *History* (audit rows of this record). Archiving an archived item is refused by the server (`ITEM_ARCHIVED`); a missing record answers `ITEM_NOT_FOUND`.

### P05 — Settings
Registry-driven (`src/domain/settings/registry.ts`): groups per tab, validation per row (integer, list, object member), "Use default", one reason for all changed keys. Read-only platform facts (time zone, currency).

### P06 — Audit log
Read-only list of every admin action: when, action, entity, reason, IP, device; filters by action, entity and admin; record dialog with the before / after diff.

### P07 — About
The About page (version, build id, environment, data source), opened from the admin menu.

## 7. Validation

Client validation mirrors the contract limits (lengths, enums); server `details[]` are mapped onto fields. Nothing is sent when the client already knows the answer.

## 8. Performance

Entry chunk and per-chunk gzip budgets (`scripts/budget.json`, `npm run check:size`); vendor chunks split; strings of a module can be lazy (`src/locales/lazy/`).

## 9. Open items

List product decisions here with an owner and a date; do not invent answers.
