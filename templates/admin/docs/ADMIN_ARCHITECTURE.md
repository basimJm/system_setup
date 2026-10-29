# __SYSTEM_NAME__ Admin Dashboard — Architecture

Rules live in `CLAUDE.md` and `.claude/rules.md`; this file explains how the pieces fit. Decisions are recorded as ADRs in `docs/adr/`.

## 1. Layers (Clean Architecture + MVC)

```
app            composition root: container, providers, routes
presentation   View (components, pages, layout) + Controller (controllers, hooks)
design         tokens -> CSS variables, theme
infrastructure config, http client, errors, logger, i18n, storage
data           Model: repository implementations (remote, mock), mappers, generated contract
domain         Model: entities, repository interfaces, pure rules, shared kernel
constants      every static value
```

Imports point inward only. `presentation` never imports `data`; it reaches repositories through `useContainer()`. Inside `domain`, `data` and `presentation`, **features are vertical slices** that never import each other (`docs/HOW_TO_ADD_A_MODULE.md`). Enforced by ESLint, `tests/architecture.test.ts` and `.dependency-cruiser.cjs` (`npm run check:layers`; `npm run graph:layers` draws the layer graph into `reports/layers.mmd`).

| MVC | Where |
| --- | --- |
| Model | `src/domain/**`, `src/data/**` |
| View | `src/presentation/components`, `pages`, `layout` |
| Controller | `src/presentation/controllers`, `hooks`, and the `app` wiring |

## 2. Data flow of one request

1. A page renders and calls its controller hook (`use<Feature>Controller`).
2. The controller asks a repository (interface in `domain/<feature>`) through TanStack Query.
3. The repository implementation in `data/<feature>` is chosen once, in `src/app/container.ts`, by `VITE_DATA_SOURCE` (`remote` or `mock`; the mock is compiled out of prod builds).
4. `HttpClient` (`src/infrastructure/http/HttpClient.ts`) adds the token and `Accept-Language`, applies a timeout, retries idempotent calls on transient statuses, validates the envelope with zod and maps failures to `AppError`.
5. The mapper turns the validated DTO into a domain entity (money stays a money string, times stay UTC instants).
6. The controller returns state (loading, empty, error, data); the page renders it with base components.

## 3. Contract tooling

The server publishes `../__SERVER_DIR__/docs/api/openapi.admin.json` (the contract of record, ADR-0001). `npm run api:sync` snapshots it into `contract/` and generates `src/data/contract/generated/dto.ts` (lazy zod factories and inferred types) and `operations.ts` (method, path, tag, flags per operation). `npm run api:check` and `tests/contract.test.ts` fail when the snapshot is older than the server file. Handwritten response types are not allowed.

## 4. Error model

Everything thrown becomes an `AppError` (`src/infrastructure/errors/AppError.ts`) with a `kind`. A server `code` (the contract's `ErrorResponse` enum) decides the kind and the message (`src/constants/errorCatalog.ts`, `errors.codes.<CODE>` in both locales). `fieldErrorsFrom()` turns `details[]` into per-field form errors. Screens show `ErrorState` / `InlineAlert`; render crashes hit `ErrorBoundary`; nothing is swallowed.

## 5. Shared kernel (`src/domain/shared`)

`Page`, `Result`, branded ids, money (money decimal strings and integer minor units, never floats), time (UTC instants, Asia/Amman display, 12-hour) and formatters whose digits follow the language (ADR-0003).

## 6. Environments and variants

Four variants: `dev-debug`, `dev-release`, `prod-debug`, `prod-release` (`vite --mode <variant>`). Public config comes from `.env.dev` / `.env.prod` or real env vars; keys are listed in `.env.example` and kept in sync with the schema by `npm run check:env`. Prod requires https URLs and the remote source. Build info (version, git sha, environment) is injected at build time and shown on `/about`; the DEV ribbon exists only in dev variants.

## 7. Quality gates (there is no GitHub CI, ADR-0002)

`npm run verify` = typecheck, lint (zero warnings; complexity, params, depth, no-deprecated), format, unit tests with a coverage floor, env check, hardcoded-value and 300-line scan, layer rules. Before a push also: the four builds, `npm run check:size`, e2e and a browser check (`.claude/rules.md` §6, §8).
