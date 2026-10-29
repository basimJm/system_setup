# **ADMIN_DIR**

React 19 + TypeScript (strict) + Vite admin panel for **SYSTEM_NAME**. Behaviour: `docs/Admin_PRD.md`. Rules for contributors and AI agents: [`CLAUDE.md`](./CLAUDE.md).

## Quick start

```bash
npm ci
npm run dev            # dev-debug build, mock data source (no server needed); mock login code is in src/constants/auth.ts
npm run verify         # typecheck + lint (0 warnings) + format + unit tests + coverage + hardcoded/300-line + layer + API doc checks
sh scripts/gate.sh     # verify + the four variant builds + size budgets (run before every push)
```

## Build variants

`npm run build:<dev-debug|dev-release|prod-debug|prod-release>` → `dist/<variant>/`. Every key is documented in `.env.example`; `npm run check:env` keeps it equal to `ENV_KEYS` and the zod schema. `.env.dev` / `.env.prod` hold the public API base URLs (`__DEV_API_URL__`, `__PROD_API_URL__`); real environment variables win.

## Contract

The server publishes `../__SERVER_DIR__/docs/api/openapi.admin.json`. `npm run api:sync` snapshots it into `contract/` and regenerates `src/data/contract/generated/`; `npm run api:check` fails when the snapshot is stale. `docs/API_CONSUMED.md` (from `npm run docs:api`) lists which task and which file consume each operation.

## What is inside

App shell (sidebar / rail / drawer, top bar, alerts bell, light/dark, RTL default + LTR, Arabic + English with lazy areas), auth (e-mail + password + e-mailed code, session in this tab's `sessionStorage` with an idle timeout), the **items** sample module (list + details + create/edit drawer, reason required), alerts, exports, registry-driven settings, audit log, profile, the data layer (envelope + error codes, pagination, exports), design tokens and the dev-only component gallery (`/design-system`). Replace the brand icon in `src/assets/app-icon.png`, the currency label `common.currency` and `BUSINESS_TIME_ZONE` in `src/constants/kernel.ts` for your product.

## Tests

- Unit/integration: `npm test` (Vitest, Testing Library).
- Responsive e2e (Android-class Chromium + iOS-class WebKit, portrait and landscape): `npm run e2e`. Offline/local Chromium only: `E2E_CHROMIUM_ONLY=true PW_CHROMIUM_PATH=/path/to/chrome npm run e2e`.
- Against the real server: `docs/REAL_SERVER_QA.md` (`qa/` scripts), results in `docs/E2E_RESULTS.md`.

## Hosting

Serve `dist/prod-release` over HTTPS with the headers that `node scripts/write-hosting.ts prod-release` writes (strict CSP with the API and socket origins, HSTS, `nosniff`, `frame-ancestors 'none'`): `docs/DEPLOY.md`.
