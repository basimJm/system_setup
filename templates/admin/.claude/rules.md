# **ADMIN_DIR** — Rules (mandatory for every task)

> These rules add to the repository root rules and to `CLAUDE.md`. They never relax them; if two rules conflict, the stricter one wins. **This `.claude/` folder is where admin-level rules, role, session and memory live.**

## 0. Token budget (applies to every admin task)

- Run the whole local gate with ONE quiet command and read only its summary: `sh scripts/gate.sh` (typecheck, lint, format, unit tests with coverage, hardcoded/layer checks, the four variant builds, `check:size`). It prints one line per step and the tail of the first failure only.
- Run e2e once per task, alone (one Playwright run at a time), and read only the pass/fail summary line and the failing test names.
- Before reading or listing anything, search for the symbol or file you need; read only the needed range of a file; do not re-read files you just wrote; do not re-run a passing step unless code changed after it.
- Keep browser checks to one script that returns a compact JSON of measurements, not screenshots or page dumps.
- Keep `.claude/session.md` to the current + last 2 task blocks and `.claude/memory.md` to durable facts: both are loaded into every turn in this folder.

## 1. Performance first

- Every route is lazy-loaded; the entry chunk stays small and vendors are split (`scripts/budget.json` is enforced by `npm run check:size`).
- Every list is paginated on the server; never fetch "all" and filter in the browser. Debounce search (constant from `constants/`), abort requests on unmount, cache with TanStack Query (stale time from constants).
- Render only what changed: stable keys, no inline object/function props on hot paths, `useMemo` / `useCallback` / `memo` only where a measurement or a stable-identity need justifies them.
- No layout thrash, no blocking work on the main thread, images sized and lazy, fonts self-hosted subsets, no unused dependencies. Check the bundle report before adding a package.
- A change that makes a page measurably slower or breaks the budget is not done.

## 2. Tests: every function and every piece of logic

- **Every function and every piece of code that can fail ships with a unit test** in the same task: pure functions, DTO parsing, repositories (against the mock routes), hooks and controllers, components (states, keyboard, axe).
- Cover the normal path, edge cases, error paths and the regression a fix addresses. A bug fix starts with a failing test.
- Tests live in `tests/`, use Vitest + Testing Library, are deterministic (fake timers/clocks, no network, no sleeps) and print nothing.
- New screens also get an e2e smoke test (Playwright). A task with untested logic is not done.

## 3. No hardcoded values

- No URLs, hosts, keys, colors, sizes, durations, limits, routes, storage keys, endpoint paths or user-visible text in components or logic. They live in `src/constants/`, `src/design/tokens/`, env config, or `src/locales/`.
- Allowed literals: `0`, `1`, `-1` for arithmetic/indexing and strings inside tests. `npm run check:hardcoded` fails the build otherwise (`// hardcoded-ok: <why>` for a justified exception).

## 4. Dev and prod environments, always

- Everything works in all four variants: `dev-debug`, `dev-release`, `prod-debug`, `prod-release`.
- Environment differences come only from validated config (`.env.dev` / `.env.prod` or real env vars; keys listed in `.env.example`), never from `if (hostname === …)` or edited code. Public values only: nothing secret is ever shipped to the browser.
- Prod: https URLs, remote data source, no mock code, no dev ribbon or gallery, no source maps in release. Dev: mock transport allowed behind the scenario switcher.
- A new setting means: key in `.env.example`, schema in `infrastructure/config`, default in `constants/`, a config test for dev and prod.

## 5. Clean code and clean architecture

- Layers (inward only): `domain` ← `data` / `infrastructure` ← `presentation` / `design` ← `app`. Pages never call `fetch`; controllers never touch the DOM; components never fetch. ESLint, dependency-cruiser and `tests/architecture.test.ts` enforce it.
- Small single-purpose functions, intention-revealing names, early returns, no duplication (search before writing a helper), no dead code, comments explain _why_.
- Strict TypeScript: no `any`, no `@ts-ignore`; narrow `unknown`; discriminated unions for states; validate every external input (API responses, storage, URL params) with zod.
- No file over 300 lines (code, CSS, JSON, tests): split by responsibility.
- Every error is handled and surfaced (`AppError`, `ErrorState`, `InlineAlert`, logger); nothing fails silently. Arabic + English strings for everything the user sees; RTL/LTR, light/dark, phone → desktop, portrait and landscape.

## 6. Build before every commit, no build or runtime errors

- **Before every commit** run, and see pass: `npm run verify` **and the build** of every variant the change can affect (`sh scripts/gate.sh` does all of it). New or changed screens also pass `npm run e2e` when the owner asks for e2e.
- Zero compile errors, zero lint/React/Vite/console warnings, zero runtime errors in the browser console. A red or skipped check is a blocker; never use `--no-verify`, never disable or skip a test to get green.

### Run it and look at it before every commit (browser UI check)

Green unit tests are not enough for a UI project. **Before every commit:**

1. **Build and run the project:** `npm run dev` (mock data) or `vite preview --mode <variant> --outDir dist/<variant>` for a built variant, and open it in a real browser.
2. **Use it like an admin:** click through every screen, state and behaviour the change touches, in Arabic RTL and English LTR, light and dark, phone / tablet / desktop widths. Exercise loading, empty, error and validation states (the mock scenario switcher in the sidebar).
3. **Console and network clean:** zero errors and zero warnings in the browser console, no failed or unexpected requests.
4. **Match the requirements, not just the code:** compare what you see with the PRD page, the BRD ids, the task row in `docs/Admin_Tasks.md` and the Design Script.
5. **Make it repeatable:** turn what you verified by hand into Playwright assertions (`e2e/`).
6. **Say it:** the commit/PR body states what was opened and compared (screens, widths, languages, themes) and the result. A UI change committed without this check is not done.

## 7. Never use deprecated APIs or outdated versions

- Use the current stable major of React, TypeScript, Vite, React Router, TanStack Query, zod, i18next and every other package; do not pin an old version to avoid a migration.
- No deprecated API of any library or of the platform. Before adding or upgrading a dependency: check it is maintained, run `npm outdated` and `npm audit --omit=dev`, commit the lockfile.
- Lint enforces what it can (`@typescript-eslint/no-deprecated`, complexity, max-params and max-depth are errors); the rest is on you in review.

## 8. Workflow

- **Branching:** every task branches from the latest admin master as `feat/adm-NNN-<key>` and its PR targets that master, never `main`. After each merge, branch the next task from the updated master.
- **No hosted CI assumed:** the gate is local. Before every push run `sh scripts/gate.sh` on the developer machine.
- One verification loop (`Loops: 1/1`), four-role review, `.claude/session.md` and `.claude/memory.md` kept current. Server-side pagination on every list, RTL by default, browser check before every commit.
