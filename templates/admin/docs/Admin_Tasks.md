# __SYSTEM_PREFIX__-Admin-Dashboard — Task Backlog

> Read through `python3 scripts/tasks.py next admin` when the monorepo tool exists; otherwise take the first `TODO` row whose `Needs` are `DONE`. One branch per task from the admin master; the PR targets it. Every row names the PRD pages (`docs/Admin_PRD.md`) and the operations (Appendix A) it touches.

## 1. Status legend
`TODO` ready · `IN PROGRESS` · `IN REVIEW` (PR open) · `DONE` · `BLOCKED` (a `Needs` row is not done) · `PENDING` (owner input).

## 2. Working rules
Branch per task, unit tests for every change, no hardcoded values, AR + EN strings, `sh scripts/gate.sh` green and a browser check before every commit (`.claude/rules.md`).

## 3. How a feature task is built
`docs/HOW_TO_ADD_A_MODULE.md`: domain → data (generated DTOs, remote + mock) → presentation (controller + page) → constants/locales → tests → gate → docs.

## 4. Backlog

| ID | Title | Branch | Needs | Status | Notes |
|---|---|---|---|---|---|
| ADM-001 | Project setup: variants, env contract, gate, contract tooling (`api:sync`) | `feat/adm-001-setup` | — | DONE | shipped by the template |
| ADM-002 | App shell: sidebar, top bar, themes, languages, session, idle timeout | `feat/adm-002-shell` | ADM-001 | DONE | shipped by the template |
| ADM-003 | Auth: e-mail + password + e-mail code (P00) | `feat/adm-003-auth` | ADM-001 | DONE | shipped by the template |
| ADM-004 | Design system and base components (gallery in dev builds) | `feat/adm-004-design` | ADM-001 | DONE | shipped by the template |
| ADM-005 | Items sample module: list, details, archive / restore with reason (P01, P02) | `feat/adm-005-items` | ADM-002 | DONE | reference module; replace with the product's first module |
| ADM-006 | Settings (P05), audit log (P06) | `feat/adm-006-system` | ADM-002 | DONE | shipped by the template |
| ADM-007 | Hosting: deploy `prod-release` with the security headers (`docs/DEPLOY.md`) | `feat/adm-007-hosting` | ADM-001 | PENDING | owner: host, domain, `__PROD_API_URL__` |
| ADM-008 | First product module (replace or extend items) | `feat/adm-008-<module>` | ADM-005 | TODO | name the PRD pages and operations here |

## 5. Traceability
Every PRD page (P00–P02, P05, P06) is covered by ADM-002…006; a new page gets a row before any code.

## Appendix A — Admin API (from `../__SERVER_DIR__/docs/api/openapi.admin.json`)

> The contract of record. `npm run docs:api` rebuilds `docs/API_CONSUMED.md` from this table and the code; every operation needs a consuming task here, a consumer in `src/`, or an entry in `scripts/api-exemptions.json`.

**Conventions:** base path `/admin/v1`; bearer token of the admin scope; JSON camelCase; ISO-8601 UTC timestamps; `Accept-Language: ar|en`; envelope `{success,message,data,meta?}` / `{success:false,message,error:{code,details?,traceId}}`.

| Operation | Summary (server) | Consumed by |
|---|---|---|
| `POST /auth/login` | Sign in: password check, then an e-mailed code | ADM-003 |
| `POST /auth/verify-otp` | Verify the code, issue the tokens | ADM-003 |
| `POST /auth/refresh` | Rotate the refresh token | ADM-003 |
| `POST /auth/logout` | End the session | ADM-003 |
| `GET /settings` | Every platform setting with its effective value and default | ADM-006 |
| `PUT /settings/{key}` | Change one setting (audited with reason) | ADM-006 |
| `GET /audit-logs` | Audit log, newest first | ADM-006 |
| `POST /uploads/presign` | Presigned upload for an admin-owned file | exempt (`scripts/api-exemptions.json`): no admin screen uploads a file yet |
| `POST /uploads/confirm` | Confirm an upload, get its URL | exempt (`scripts/api-exemptions.json`): no admin screen uploads a file yet |
| `GET /items` | All items (owner, status, tag and title filters) | ADM-005 |
| `GET /items/{id}` | One item with its owner | ADM-005 |
| `POST /items/{id}/archive` | Archive an item with a reason (audit log + owner notification) | ADM-005 |
| `POST /items/{id}/restore` | Restore an archived item with a reason (audit log + owner notification) | ADM-005 |

## Appendix B — Environments and build variants
`dev-debug` (mock data, `npm run dev`), `dev-release` (dev API), `prod-debug`, `prod-release` (prod API, https). Public values in `.env.dev` / `.env.prod` (keys in `.env.example`).

## Appendix C — Decisions
Record each decision as an ADR in `docs/adr/` before the task that needs it (`docs/adr/README.md`).
