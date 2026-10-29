# **ADMIN_DIR** — Rules for AI Agents

> These rules add to the repository root `CLAUDE.md` and `.claude/*.md` when the project lives in a monorepo. They never relax them. If two rules conflict, the stricter one wins. If documents conflict, stop and ask.
>
> **Admin-level rules and role live in this project's own `.claude/` folder — mandatory, read and apply both:**
>
> - Rules: @.claude/rules.md
> - Role (senior web developer: React, JS, TS): @.claude/roles.md

> **Also auto-loaded (never read them with a tool):**
>
> - Session (current task, integration status): @.claude/session.md
> - Memory (durable admin facts): @.claude/memory.md

## 0. Per task (nothing else is read up front)

1. Take the task row from `docs/Admin_Tasks.md` (through `python3 scripts/tasks.py next admin` when the monorepo tool exists): ID, branch, needs, notes.
2. Read only the `docs/Admin_PRD.md` pages (P00–P07 and the ones you add) and `docs/Admin_BRD.md` ids the row names, the Design Script section and the matching design file for UI work (grep the heading, read that range).
3. `docs/ADMIN_ARCHITECTURE.md` / `docs/adr/` only when the task changes a layer or makes an Appendix C decision; `.claude/Integration.md` when it touches the API, realtime or the mock; the server's domain document for enums, rules and error codes.

## 1. The Rules (non-negotiable)

1. **Clean Architecture + MVC** (§2). Dependencies point inward only; ESLint, `npm run check:layers` and `tests/architecture.test.ts` enforce it.
2. **Never hardcode.** No URLs, hosts, keys, colors, sizes, durations, limits, routes, storage keys or user-visible text in components. They live in `src/constants/`, `src/design/tokens/`, env config, or `src/locales/`. `npm run check:hardcoded` fails the build otherwise.
3. **Arabic and English for every string.** Add each key to the same area file under `src/locales/ar/` and `src/locales/en/` (or a lazy area in `src/locales/lazy/`); `tests/i18n.test.ts` fails on a missing key, empty value, or placeholder mismatch. Arabic (RTL) is the default.
4. **Performance first.** Lazy-load every route, keep the entry small, split vendors, paginate every list server-side, memoize only where measured, no layout thrash. `scripts/budget.json` sets gzip budgets; `npm run check:size` enforces them.
5. **All four build variants must build:** `dev-debug`, `dev-release`, `prod-debug`, `prod-release` (§4).
6. **Run the full local gate before every push:** `sh scripts/gate.sh` (verify, all four variant builds, `check:size`); e2e only when the owner asks. Before every commit, the browser UI check of `.claude/rules.md` §6.
7. **Zero runtime errors, compile errors and warnings.** `tsc` strict, `eslint --max-warnings 0`, no console output in tests/builds, no React/Vite warnings.
8. **No file longer than 300 lines** (code, CSS, JSON, tests). Split instead. ESLint `max-lines` and the hardcoded scan enforce it.
9. **Responsive everywhere:** phone, tablet, desktop; portrait and landscape; every size scales (rem tokens, fluid root font size, `minmax(0, …)` grids, no horizontal page scroll). New UI ships with an e2e check in `e2e/`.
10. **One branch per task**, branched from the updated admin master. The PR targets that master, never `main`; merge it only after the local gate (rule 6) is green.

## 2. Architecture — Clean Architecture with MVC

```
src/
  constants/        ALL static values (routes, nav, icons, limits, storage keys, status tones, error kinds)
  design/           tokens/ (colors, layout), theme/ (CSS variables, theme provider), styles/ (token-only CSS)
  domain/           M — entities + repository INTERFACES + pure rules. Imports nothing from the app.
  data/             M — repository implementations (remote over ApiClient, mock routes for dev builds), generated contract
  infrastructure/   config, http client, errors, logger, i18n, storage, observability. No UI.
  presentation/
    components/     V — dumb, reusable base components (core, form, data, feedback, overlay, charts, templates)
    pages/          V — screens without a module (login, about, errors, dev-only gallery)
    layout/         V — app shell, sidebar, topbar
    controllers/    C — hooks that orchestrate repositories, validation and navigation for a page
    hooks/          shared UI hooks
    <feature>/      one folder per module (items is the reference)
  app/              composition root: container (wiring), providers, routes
  locales/          ar/*.json, en/*.json, lazy/ (areas loaded with their screens)
```

- **Model** = `domain` + `data`. **View** = `presentation/components|pages|layout|<feature>`. **Controller** = `presentation/controllers`, `hooks` and the `app` composition root.
- Allowed imports: `domain` → `constants`; `infrastructure` → constants; `data` → domain, infrastructure; `design` → constants, infrastructure/storage; `presentation` → everything except `data` (it reaches repositories through `useContainer()`); `app` → everything.
- New feature = vertical slice (`domain/<f>`, `data/<f>`, `presentation/<f>`); features never import each other (`npm run check:layers`). Checklist: `docs/HOW_TO_ADD_A_MODULE.md`.
- Pages never call `fetch`; they use a controller or a repository through the container. Controllers never touch the DOM or JSX. Components never fetch.
- Every cross-project dependency (API, socket) sits behind a domain interface with a real and a mock implementation, selected only by `VITE_DATA_SOURCE`. The mock is compiled out of prod builds.

## 3. Design System

- Add or change a color, size or font only in `src/design/tokens/`. `buildCssVars()` turns tokens into CSS custom properties; stylesheets use `var(--…)` only (`npm run check:hardcoded` rejects raw lengths and colors).
- Use logical CSS (`inline-start/end`, `margin-inline`) so RTL/LTR and light/dark work without overrides. Mirror direction-bearing icons with `directional`.
- Every base component handles: loading (skeleton), empty, error with retry, disabled, focus-visible, keyboard, and an accessible name. Reuse `src/presentation/components/` before writing a new one; show a new one in the dev-only gallery (`tests/gallery-coverage.test.ts`).
- Layout classes come from `useViewport()` (`compact` < 640, `medium` < 1024, `expanded`), exposed as `data-bp` / `data-orientation` on `<html>`.

## 4. Build Variants and Environments

| Variant        | Env  | Type    | Minified | Source maps | Mock data source |
| -------------- | ---- | ------- | -------- | ----------- | ---------------- |
| `dev-debug`    | dev  | debug   | no       | yes         | allowed          |
| `dev-release`  | dev  | release | yes      | no          | allowed          |
| `prod-debug`   | prod | debug   | no       | yes         | **excluded**     |
| `prod-release` | prod | release | yes      | no          | **excluded**     |

- Pick one with `npm run build:<variant>` (Vite `--mode <variant>`); `npm run dev` uses `dev-debug`.
- Public, non-secret values come from `.env.dev` / `.env.prod` (committed placeholders; keys in `.env.example`) or real env vars. Missing/invalid values fail the build and the app start with a `ConfigError` that names keys only. Prod needs https URLs.
- "Android and iOS" for this web panel means the browsers and viewports those platforms use: Chrome on Android and Safari on iOS, each in portrait and landscape (`playwright.config.ts` projects).

## 5. Errors

- All failures become `AppError` (`infrastructure/errors`) with a `kind`; every kind has an `errors.<kind>` message in both locales; every server code has `errors.codes.<CODE>` (`constants/errorCatalog.ts`, kept equal to the contract enum by `tests/errorCatalog.test.ts`). The server's localized `message` is shown when present; branch on `code`/`kind`, never on text.
- `HttpClient` is the only network code: timeout, retry of idempotent calls on transient failures, envelope validation (zod), 401 → refresh once, then sign-out. Never swallow errors: log through `Logger` (redacts tokens/passwords/codes) or surface them.
- Render crashes are caught by `ErrorBoundary`; `window.error` and unhandled rejections are logged by `registerGlobalErrorHandlers`.
- Tokens stay in memory, mirrored only to the tab's `sessionStorage` (`tabStorage`, so a reload keeps the admin signed in; gone when the tab closes); never `localStorage`. `safeStorage` is only for UI preferences.

## 6. Tests and Delivery

- Every task ships unit tests (Vitest + Testing Library) for its acceptance criteria and edge cases, and e2e (Playwright) for new screens. Run `npm run verify`; locally e2e: `E2E_CHROMIUM_ONLY=true PW_CHROMIUM_PATH=<chrome> npm run e2e`.
- Follow the workflow: branch → implement → one verification loop (`Loops: 1/1`) → 4-role review → full local gate → PR into the admin master. Record the task in `.claude/session.md`, durable facts in `.claude/memory.md`.
- Admin APIs: behaviour from the PRD, wire format from the generated server contract (`../__SERVER_DIR__/docs/api/openapi.admin.json` → `npm run api:sync`; `.claude/Integration.md`).
