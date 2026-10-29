# **SERVER_DIR** — Rules for AI Agents

> These rules add to the root `CLAUDE.md` and `.claude/*.md`. They never relax them. If two rules conflict, the stricter one wins. If documents conflict, stop and ask.

**Auto-loaded with this file (never read them with a tool):**

- Session (current task, integration status): @.claude/session.md
- Memory (durable server facts): @.claude/memory.md

## 0. Per task (nothing else is read up front)

1. `python3 scripts/tasks.py next server` → the task row (ID, branch from `origin/server`, needs, notes). Root rules/roles/hooks and this file are already in context.
2. Only the `docs/BUSINESS_DOMAIN.md` sections and `docs/__SYSTEM_PREFIX___Backend_BRD.md` ids (BE-xx, NFR-xx) the row names, plus the PRD section of the client the endpoint serves (grep the heading, read that range).
3. `.claude/Integration.md` when the task changes a contract or a provider; root `INTEGRATION.md` §3 for the contract rules (the generated `docs/api/openapi.*.json` IS the contract).

## 1. Business Domain First (double-check rule)

- Every schema, enum, rule, status transition, permission, job, setting and error code comes from `docs/BUSINESS_DOMAIN.md`. Do not invent fields or behaviour.
- **Check twice.** Before coding: list the domain sections and BRD ids the task touches in the task's acceptance criteria. Before pushing: re-read them and confirm code, tests and contract match; record it in the verification loop.
- If the code needs something the domain does not define, stop and ask. When the owner decides, update `docs/BUSINESS_DOMAIN.md` in the same PR.

## 2. Architecture (TypeScript, layered, SOLID)

- TypeScript `strict` mode. No `any`; use `unknown` and narrow it. Express, Mongoose, Redis, Socket.IO and BullMQ.
- One direction of flow: **route → middleware → controller → service → repository → schema (Mongoose model)**
  | Layer      | Responsibility                                                                                                   | Must not                                      |
  | ---------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
  | Route      | Declares path, method and middleware chain; mounted under its namespace root with `mount()`                      | Contain logic                                 |
  | Middleware | Cross-cutting work: language, auth, token scope, merchant permission, validation, rate limit, request ID, errors | Contain business rules                        |
  | Controller | Reads the validated request, calls one service, returns the base success response                                | Touch the DB, contain rules, build error JSON |
  | Service    | Business logic and orchestration; throws typed errors                                                            | Know about `req`/`res`                        |
  | Repository | The only code that queries MongoDB; returns plain typed objects                                                  | Contain business rules                        |
  | Schema     | Mongoose schema, indexes and types exactly as in `docs/BUSINESS_DOMAIN.md`                                       | Contain business logic                        |
- External services (OTP, storage, push and email, payments, analytics) are used only through the ports in `src/providers/<name>/types.ts`, injected into services so they can be faked in tests. Real adapters (`src/providers/<name>/real.ts`) wrap the `__NPM_SCOPE__/<sdk>` packages; see `src/providers/README.md`.

## 3. Separate Customer, Merchant and Admin Modules

- Three namespaces, each with its own router root, token scope and modules. A token from one scope never works on another.
  ```
  src/modules/customer/<feature>/   → /customer/v1
  src/modules/merchant/<feature>/   → /merchant/v1   (+ loadMember and permission middleware on every route)
  src/modules/admin/<feature>/      → /admin/v1      (+ reason + audit log on every write)
  src/modules/shared/<feature>/     → router factories used by more than one namespace (otp, uploads, notifications, items)
  ```
- A module never imports from another namespace's module. Logic that more than one namespace needs lives once in `src/domain/<area>/`.
- Each feature folder holds `<feature>.routes.ts`, `.controller.ts`, `.validation.ts`, `.openapi.ts`; the service lives in `src/domain`. The sample feature `items` is the reference shape.

## 4. Folder Layout

```
src/
  app.ts, server.ts         # app wiring; process start/stop and service construction
  routes/index.ts           # root router: mounts /customer/v1, /merchant/v1, /admin/v1, health, webhooks
  config/                   # validated env config (fails fast at startup); no defaults for secrets
  constants/                # ALL static values: limits, timeouts, enums, error codes, HTTP status, keys, regexes
  locales/ar.json, en.json  # every user-facing message key, in both languages
  middlewares/              # language, requestId, auth, permission, validate, rateLimit, sanitize, security, notFound, errorHandler
  models/                   # Mongoose schemas (shared by all namespaces); ALL_MODELS gets the indexes created
  repositories/             # data access per collection (BaseRepository / AppendOnlyRepository)
  domain/                   # business logic used by the namespaces (auth, otp, settings, audit, notifications, uploads, items, team)
  providers/                # ports + in-repo fakes + real adapter stubs; selected by `*_PROVIDER=fake|real`
  modules/customer|merchant|admin|shared|webhooks/<feature>/
  jobs/, sockets/           # BullMQ scheduler + periodic jobs; Socket.IO hub, rooms and event emitters
  seeds/                    # indexes, first admin, one-command development data
  utils/                    # shared helpers: errors/, response/, i18n/, time/, pagination/, logger/, redis/, database/, async/
```

## 5. No Hardcoding, No Static Data in Code

- Values that change between environments (URLs, hosts, ports, keys, secrets, DB names) come from `config/`, which reads them from env. Never commit `.env*` files except `.env.example`, and never edit `.env*` files without permission.
- Static values (limits, timeouts, page sizes, regexes, status codes, error codes, enum values, cache keys, queue names, socket event names) come from `constants/`.
- Business-tunable values come from the `settings` collection (`src/domain/settings/definitions.ts`), with defaults in `constants/settings.ts`.
- User-visible text comes from `locales/` only. Inline literals are allowed only for `0`, `1` and `-1` used for arithmetic or indexing, and for strings in tests.

## 6. Base Responses (always)

Every endpoint returns one of two shapes, built only by the helpers in `utils/response/`. Never hand-write `res.json(...)`.

```jsonc
{ "success": true,  "message": "<localized>", "data": { ... } | [ ... ] | null, "meta": { "page": 1, "pageSize": 10, "total": 42 } }
{ "success": false, "message": "<localized>", "error": { "code": "ITEM_NOT_FOUND", "details": [ ... ], "traceId": "<request id>" } }
```

`code` values come from `docs/BUSINESS_DOMAIN.md` §11 and are mirrored in `constants/errorCodes.ts`. Clients branch on `code`, never on `message`. `details` holds field-level errors as `{ field, code, message }`.

## 7. Arabic and English for Every Response

- Read `Accept-Language` (`ar` | `en`; default `ar`) in middleware, and localize every `message` and every validation detail.
- Add every new message key to **both** `ar.json` and `en.json`; `tests/i18n.test.ts` fails otherwise.
- Content stored in two languages is saved as `{ ar, en }`: customer and merchant responses return the requested language; admin responses return both. Notifications and push messages are localized to the recipient's saved language, not the request language.

## 8. Errors (handle every error, including unexpected ones)

- All errors extend `BaseError` in `utils/errors/` (`ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `BusinessRuleError` 422, `RateLimitError` 429, `PaymentError` 402, `ExternalServiceError` 502/503, `InternalError` 500). Services throw typed errors only.
- **One** global `errorHandler` turns every error into the base error response and maps library errors (Mongoose cast/validation 400, duplicate key 409, JWT 401, body parser 400/413, network/timeouts 503). Unknown errors become `INTERNAL` with a generic message; stacks and provider payloads are logged, never returned.
- Async route handlers are wrapped by `utils/async`. Jobs and socket handlers use the same error utilities. Process-level: `unhandledRejection`/`uncaughtException` log, close and exit; `SIGTERM` shuts down gracefully.
- Logs are structured and include `traceId`. Never log tokens, OTP codes, passwords, keys or full phone numbers (`utils/logger/redact.ts`).

## 9. Clean, Reusable, Readable, Scalable

- Never duplicate code: search `utils/`, `domain/` and `repositories/` first. Small, single-purpose functions; return early; comment the _why_.
- Validate every input (body, params, query, headers, socket payloads, webhooks) with a zod schema in `<feature>.validation.ts`, through the `validate` middleware.
- Every list is paginated; every query is backed by an index declared in its schema; no N+1 queries; Redis for locks, rate limits and cache; services stateless so several instances can run.
- Instants are UTC; business dates use `settings.timezone`, only through `utils/time`.

## 10. Tests and Delivery

- Every task ships with unit tests: services and domain rules first, plus the error handler, the response helpers and the locale-completeness check. `npm run verify` (typecheck, lint, format, tests, build) must pass before a push.
- Follow the root workflow: branch from the freshly fetched `origin/server`, PRs target `server`, one verification loop (`Loops: 1/1`), four-role review (`Review: PASSED`) recorded in `.claude/session.md`, `tasks.py set SRV-NNN <STATUS>`.

## 11. Swagger and Postman: updated after every task (mandatory)

- The API docs are generated from code and live in the repo. Do not edit the generated files by hand.
  | What                              | Where                                                                                                                |
  | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
  | OpenAPI definition of an endpoint | `<feature>.openapi.ts` next to its routes, built from the same zod schemas as `<feature>.validation.ts`              |
  | Registration per namespace        | `src/docs/index.ts` (`common`, `customer`, `merchant`, `admin`)                                                      |
  | Swagger / OpenAPI output          | `docs/api/openapi.<name>.json`, served as Swagger UI at `/docs` outside production                                   |
  | Postman output                    | `docs/api/postman/__SYSTEM_PREFIX__-<Name>.postman_collection.json` and `__SYSTEM_PREFIX__.postman_environment.json` |
- After every task: update the `*.openapi.ts`, run `npm run docs`, run `npm run contract:bump -- <name> "<client impact>"` when the contract changed, commit the regenerated files in the same PR, and name the client tasks that must re-sync in the task block. If the task changes no API, write `API docs: no change`.
- Mount every feature router with `mount(router, path, child)` from `src/routes/mount.ts`, so `tests/docs.test.ts` can find all routes. It fails when a committed file is stale, when a route has no OpenAPI entry, or when an OpenAPI entry has no route.
