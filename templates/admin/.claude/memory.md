# **ADMIN_DIR** — Memory (durable facts; keep short, replace instead of append)

> Loaded on every turn while working in this folder: keep it to facts that save a future session an investigation (decisions, paths, commands, gotchas).

## Facts

- `CLAUDE.md` = the rules (read first). React 19 + TS strict + Vite, Vitest, Playwright. Commands: `npm run verify` (typecheck, lint 0 warnings, format, tests + coverage floor, `check:env`, `check:hardcoded`, `check:layers`, `docs:api:check`), `sh scripts/gate.sh` (verify + four builds + `check:size`), `npm run api:sync` (after the server OpenAPI changed), `npm run docs:api` (rebuilds `docs/API_CONSUMED.md`).
- Layers: `domain` (interfaces, rules) → `data` (remote/mock repos, generated contract) → `infrastructure` (config/http/errors/logger/i18n/storage) → `design` (tokens → CSS vars; stylesheets use `var(--…)` only) → `presentation` (components, layout, controllers, hooks, one folder per feature) → `app` (container, providers, routes).
- Variants = Vite mode `<dev|prod>-<debug|release>`; public env via `.env.dev|.env.prod` or real env (keys in `.env.example`); prod needs https URLs + remote source and compiles out the mock. Tests and builds need `VITE_API_BASE_URL` / `VITE_SOCKET_URL` (gate.sh sets placeholders).
- Reference module = items: `domain/items/items.ts` (entity, rules, repository interface), `data/items/RemoteItemsRepository.ts` (generated DTOs + `ApiClient`), `data/mock/itemsRoutes.ts` (fixtures, `MockBusinessError` for `ITEM_NAME_TAKEN`), `presentation/items/{ItemsPage,ItemDetailsPage,ItemDrawer,itemFilters}`, lazy strings `locales/lazy/items.ts`, tests `tests/items.test.tsx`.
- Shared conventions: `useListController(OPTIONS)` keeps list state in the URL; `useResourcePanel` drives list + side panel; `ResourceDrawer` adds the audit reason (`reason.*` strings); `StatusBadge kind value` with tones in `constants/status.ts`; `ExportMenu` + `useExportRunner(kind, params)`; `useLazyStrings(bundle)` for a lazy locale area; realtime events → query invalidations in `constants/realtime.ts`.
- Mock login: any e-mail, password of `MIN_PASSWORD_LENGTH`, code `MOCK_OTP_CODE` (`src/constants/auth.ts`); the sidebar scenario switcher (dev) forces empty / error / slow answers.
- Gotchas: Modal effects must not depend on inline `onClose` (focus steal); grid content needs `minmax(0, 1fr)` or tables widen the page; `vite preview` needs `--mode <variant>`; the Stop/guard hooks of a monorepo read `Loops: 1/1` and `Review: PASSED` from `.claude/session.md` before a push.
