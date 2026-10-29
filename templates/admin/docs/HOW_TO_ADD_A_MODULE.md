# How to add a feature module

A feature (items, orders, members, …) is a **vertical slice** across the layers. The slice rules are enforced by `npm run check:layers` (`.dependency-cruiser.cjs`, rules `feature-isolation-*`) and by `tests/layers.test.ts`.

## Folders

```
src/domain/<feature>/         entities, enums, <Feature>Repository interface, pure use-case functions
src/data/<feature>/           Remote<Feature>Repository (generated DTOs, no hand-written URLs)
src/data/mock/<feature>Routes.ts  fixture routes (typed by the generated DTOs), registered in data/mock/fixtures.ts
src/presentation/<feature>/   <Feature>Page.tsx, <Feature>DetailsPage.tsx, <Feature>Drawer.tsx, <feature>Filters.ts
src/app/routes.tsx            lazy route          src/constants/nav.ts   nav entry
src/locales/{ar,en}/<area>.json every new string, same keys; lazy area = locales/lazy/<area>.ts + lazyAreas.ts
tests/<feature>.test.tsx      domain rules, repository through the mock, page + drawer tests
e2e/<feature>.spec.ts         smoke test of the screen
```

## Import rules (what the checker enforces)

| From | May import | Never imports |
| --- | --- | --- |
| `domain/<f>` | itself, `domain/shared` | another `domain/<g>`, any other layer |
| `data/<f>` | itself, `domain/*`, `data/shared`, `data/contract`, `data/mock`, `data/api`, `data/realtime`, `infrastructure`, `constants` | another `data/<g>`, `presentation`, `app` |
| `presentation/<f>` | itself, `components`, `layout`, `hooks`, `controllers`, `pages`, `utils`, `shared`, `domain`, `design`, `infrastructure` | another `presentation/<g>`, `data` (use `useContainer()`) |

Two features that need the same thing move it to the shared directory of the layer (for example `domain/shared`) instead of importing each other. Cross-feature navigation goes through `constants/routes.ts`; cross-feature data is read through the container's repositories, not through the other feature's files.

## Calling the API (`src/data/api`)

A repository never builds URLs or parses responses itself. It defines each endpoint once from the generated contract and runs it through `ApiClient`:

```ts
const listItems = defineEndpoint(OPERATIONS.getItems, { data: getItemsDataSchema, query: getItemsQuerySchema });
const update = defineEndpoint(OPERATIONS.patchItemsById, { data: ..., body: ... }, { idempotent: true });

api.executePage(listItems, { query, signal });           // Page<Item> = items + meta
api.execute(update, { params: { id }, body });           // body/query are checked before anything is sent
useQuery({ queryKey: queryKey(listItems, { query }), queryFn: ({ signal }) => ... });  // unmount aborts
```

- `defineEndpoint` throws when the schemas disagree with the contract (body/query present or missing), so a contract change fails the first test that imports the endpoint.
- Server errors arrive as `AppError` with `traceId` and `details[]` (`fieldErrorsFrom` maps them onto form fields); a failed local check uses the same shape with `body.<field>` names.
- `idempotent: true` adds a fresh `Idempotency-Key` per call (reuse the key when retrying the same command). OPEN: the admin OpenAPI does not define this header yet; the server must accept it before the client relies on it.

## Checklist (copy into the task block in `.claude/session.md`)

1. **Read** the PRD page, the BRD ids, the task row, the Design Script and `design/*.dc.html`; list the admin operations the task consumes (`src/data/contract/generated/operations.ts`, `docs/Admin_Tasks.md` Appendix A). If the server lacks one, the task is `PENDING` with the gap id — do not invent endpoints.
2. **Domain:** entities and enums named like the server's domain document; repository interface; pure rules with unit tests (`src/domain/items/items.ts` is the model).
3. **Data:** DTO schemas come from `api:sync` output (never hand-written); `Remote…Repository` over `ApiClient`; fixture routes in `data/mock/<feature>Routes.ts`; register in `data/repositories.ts`, `data/mock/fixtures.ts` and `tests/helpers/render.tsx`.
4. **Presentation:** controller hook (TanStack Query, key factory) → page built from base components; loading, empty, error with retry, forbidden, validation and realtime states.
5. **Constants and text:** routes in `constants/routes.ts`, nav in `constants/nav.ts`, page in `app/routes.tsx`; status tones in `constants/status.ts`; Arabic **and** English strings; no literal URLs, colors, sizes or timings.
6. **Tests:** unit per layer, page test, e2e smoke; coverage floor holds (`npm run test:coverage`).
7. **Gate:** `npm run verify`, four variant builds, `npm run check:size`, e2e, browser check in AR/EN, light/dark, phone/tablet/desktop (`.claude/rules.md` §6, §8).
8. **Docs:** task row to `DONE`, Appendix A row for every new operation, `.claude/session.md` block with `Loops: 1/1` and `Review: PASSED`, durable facts to `.claude/memory.md`.

## List screens: state in the URL

Use `useListController(OPTIONS)` (`presentation/controllers`) with a module-level `OPTIONS = { filterKeys, sortKeys, defaultSort }`. It keeps page, page size, search (500 ms debounce), sort and filters in the query string, so links and back/forward work. Map `controller.state` to the endpoint's query parameters in the feature's controller.
