# __SYSTEM_NAME__ — Monorepo Guide for AI Agents

> **MANDATORY, auto-loaded on every turn (never read these with a tool):**
> - Rules: @.claude/rules.md
> - Roles: @.claude/roles.md
> - Hooks & workflow (4-role review, task block template): @.claude/hooks.md
> - Session index (all projects): @.claude/session.md
> - Memory (cross-project facts): @.claude/memory.md
>
> Working inside a project folder also loads that project's `CLAUDE.md` + `.claude/{session,memory}.md`. Hooks in `.claude/settings.json` enforce branching, no-hardcode, unit tests, `Loops: 1/1` and the review; never disable or bypass them.

## 0. How a session works (token-minimal, mandatory)
1. Nothing is read up front beyond the auto-loaded files. **One project per session.**
2. `python3 scripts/tasks.py next <project>` (project keys = the entries of `.claude/projects.json`) gives the one task to do: ID, branch, dependencies, PRD sections and API operations. Never open a backlog file whole.
3. Read only the PRD/BRD/`BUSINESS_DOMAIN.md` sections and OpenAPI operations the task row names (grep the heading, read the range). `INTEGRATION.md` §1–§5 once when a task touches two projects.
4. Branch from the project's master (`INTEGRATION.md` §1), `tasks.py set <ID> "IN PROGRESS"`, task block in the **project's** `.claude/session.md`, implement + tests, one verification loop, 4-role review, gate, PR into the master, merge, `tasks.py set <ID> DONE` (this unblocks dependents in other projects and rewrites the board), next task.

## 1. The business in one paragraph
<!-- From the owner's answers to SYSTEM_SETUP (raw copy: `docs/BUSINESS_INPUT.md`). Replace every TBD with the owner before the first PRD. Name: __SYSTEM_NAME__ (__SYSTEM_NAME_AR__). -->
**__SYSTEM_NAME__** (__SYSTEM_NAME_AR__):
__BUSINESS_SUMMARY__

Facts every agent needs before reading a PRD: default language `__DEFAULT_LANGUAGE__` (RTL __RTL__) + the second language; currency `__CURRENCY__`, amounts as integer minor units (`__CURRENCY_MINOR_UNIT__`); timestamps stored in `__STORED_TIME_ZONE__`, business dates/hours computed in `__BUSINESS_TIME_ZONE__`. Actors (details `BUSINESS_DOMAIN.md` §1):
__BUSINESS_ACTORS__

## 2. Repository map (details, branches and backlogs: `INTEGRATION.md` §1)
| Path | Project | Status (__DATE__) |
|---|---|---|
| `__SERVER_DIR__/` | Backend API (the only owner of business rules, data and money) | scaffold |
| `__ADMIN_DIR__/` | Admin web panel (full visibility and control) | scaffold |
__APPS_TABLE__
__SDKS_TABLE__
| `.claude/tools/` | Generators and workspace tools (README inside each) | — |

Each project: `docs/` (PRD = behaviour source of truth, BRD, Design Script, `*_Tasks.md` backlog), `design/` (apps: visual reference), `.claude/` (session, memory, Integration). Precedence: **PRD > BRD > Design Script > design files**; conflicts → stop and ask. `BUSINESS_DOMAIN.md` = the single source for schemas, enums, rules, state machines, permissions, jobs, settings and error codes (mandatory for server, contract and cross-project work).

## 3. Integration essentials (full map and live board: `INTEGRATION.md`)
- REST + JSON, one namespace per client with its own token scope (e.g. `/customer/v1`, `/merchant/v1`, `/admin/v1`); `Accept-Language` on every request; one envelope `{success,message,data,meta?}` / `{success:false,message,error:{code,details?,traceId}}`; clients branch on `code`, never on the message. **Contract = the generated server OpenAPI** (`__SERVER_DIR__/docs/api/openapi.*.json` + Postman); clients regenerate DTOs from it, never hand-write them.
- Auth: server-generated one-time codes delivered through a provider port (fake provider on dev/QA with a fixed code), single-use proof token, JWT access + rotating refresh; staff/admin = email + password + second factor. Limits on requests and wrong codes live in settings, not code. Permissions: a fixed list of grantable keys enforced on every endpoint, socket event and notification; hidden-not-disabled in UI.
- Real-time: socket rooms per user / per tenant (permission-filtered) / admin; every real-time event also has a push data message and a refresh-on-foreground fallback, de-duplicated by entity id.
- Push: one Firebase (or equivalent) project per environment, one registration per app × platform. Jobs: reminders, pending alerts, auto-cancel/expiry, subscription checks, grace-period deletion, reports — deterministic job ids so they can be removed.
- Integrations chosen by the owner (each behind a port/SDK; `decide later` = fake adapter until decided):
__BUSINESS_INTEGRATIONS__
- Files: presigned upload → device compression → direct object-storage upload → confirm → CDN URL; private files via short-lived signed URLs. Analytics: apps track screens/actions client-side; server events in the database; apps never send analytics to the backend.

## 4. Core business rules (enforced on the server)
<!-- The owner's rules, numbered; keep the numbering stable because tasks and reviews cite "CLAUDE.md §4 rule N". Refine each into a testable `BUSINESS_DOMAIN.md` §5 rule (visibility conditions, time arithmetic, no double booking = locks + atomic re-validation, state machine, refund per cancel actor, snapshots, idempotent payments, approval before publishing, audit log + reason on admin actions). -->
__BUSINESS_RULES__

## 5. Engineering conventions
- Never commit secrets (`.env*` except `.env.example`, keystores, service-account JSON, xcconfig secrets); never edit `.env*` without permission.
- Backend: `__SERVER_DIR__/CLAUDE.md` (layers route → middleware → controller → service → repository → schema; one module per client namespace; AR+EN locales; constants, no magic numbers; tests for business rules; regenerate the API docs on every endpoint change and commit them).
- Mobile: `<app>/CLAUDE.md` (Clean Architecture + MVI, no hardcoding, AR+EN resources, all variants build, file-size limit, portrait + landscape; Firebase, payments and maps behind interfaces).
- Admin: `__ADMIN_DIR__/CLAUDE.md` (local gate, browser check before every commit, RTL default, server pagination, DTOs regenerated from the contract).
- SDKs (`__SYSTEM_SLUG__-<name>/`, published as `@__SYSTEM_SLUG__/<name>`): `<pkg>/.claude/Rules.md` (ports + adapters, dev on localhost, prod strict, `npm run verify` + loop test, `Integration.md` kept current). No business rules inside packages.
- Environments dev and prod; gates are local unless the owner enables CI for a project.

## 6. Open decisions (owner; do not invent answers)
<!-- One line per decision only the owner can take; each becomes a `PENDING` backlog row (`python3 scripts/tasks.py blocked` lists them). TBD answers from the setup questions are listed here until the owner fills them in `BUSINESS_DOMAIN.md`. -->
__OPEN_DECISIONS__
