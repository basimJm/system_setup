# __SYSTEM_SLUG__-__SDK_KIND__ — Rules (mandatory, every task)

> Rules for every `__SYSTEM_SLUG__-*` SDK package. They never relax; a package may add stricter ones.

## 1. Quality
1. **Code is clean**: small files (<= 300 lines), small functions, one responsibility, strong types (TypeScript strict, no `any`), clear names, no dead code, no duplication.
2. **Flexible to change any third party.** The public API is an interface (port). Every vendor/gateway/method lives in its own adapter behind that port, chosen by configuration. Changing a vendor = adding one adapter + one config value; no consumer code changes.
3. **Easy to implement from any project.** One factory, typed options, zero __SYSTEM_NAME__ business rules, zero global state, ESM + CJS builds with `.d.ts`, README quick start, a fake/in-memory adapter for consumers' tests.
4. **Performance first**: no needless I/O, reuse clients/connections, batch where the vendor supports it, bounded timeouts, bounded memory, no blocking work on hot paths, lazy-load heavy vendor SDKs.

## 2. Environments and configuration
5. **Always handle dev and prod.** `environment: "dev" | "prod"` is part of the options. Prod is strict (real adapter required, HTTPS endpoints, fake and process-local adapters refused, secrets required). Dev is permissive but explicit.
6. **Dev works on localhost**: every adapter has a local mode (fake, in-memory, local sink or mock server) selectable by configuration, with no real credentials.
7. **Never hardcode.** No literals for URLs, hosts, ports, keys, regions, buckets, timeouts, limits, retry counts, header names, status strings, user-visible text. Use `constants/` (names, defaults), injected options (values) and environment variables (secrets). Secrets are injected by the consumer and never stored, logged or committed.

## 3. Correctness
8. **Always handle all response statuses**: every vendor HTTP/status/outcome value is mapped explicitly to the package's normalized result enum; unknown values map to an explicit `UNKNOWN` outcome (never silently success) and are logged with the raw response (redacted).
9. **Always handle all error cases**: validation, configuration, authentication/authorization, network, timeout, rate limit/quota, vendor 4xx/5xx, malformed vendor response, partial failure, duplicate/idempotent replay, cancellation. Every failure becomes a typed error (`code`, `message`, `retryable`, `cause`, `details` without secrets). Retry only retryable errors with capped exponential backoff + jitter.
10. **Always assume you are missing requirements.** Before and after implementing, re-read the BRD (`docs/`), list what is unspecified or ambiguous, write it down in `Integration.md` §Open questions, implement the safest default behind configuration, and ask the owner when the choice changes behaviour.

## 4. Tests and delivery
11. **Unit tests for every case, every file, every function**: each source file has a test file; each exported function covers success, each error path, each status mapping, boundaries, and idempotency/replay. Coverage gate: 100 % of functions and >= 95 % of lines/branches (enforced in `jest.config.js`). Vendor SDKs/HTTP are mocked; no real network in unit tests.
12. **Build the SDK before any commit/push** (`npm run build` must succeed, typecheck + lint + format + tests green, `.d.ts` emitted, package `exports` verified with the consumer smoke test).
13. **Run the loop test before every push**: a looped end-to-end test that drives the full flow against the dev/local adapter repeatedly (at least 50 iterations; with concurrency for idempotency) and must be stable and leak-free. `npm run test:loop` (part of `npm run verify`).
14. **After every commit/push, update `.claude/Integration.md`** whenever the implementation changed (API, options, env keys, error codes, status mapping, adapters, versions, open questions). A change without the matching Integration.md update is not done.
15. Never commit secrets or `.env*` (except `.env.example` with keys only). Never push to the default branch; branch + PR as in the repo rules. Never use `--no-verify`.

## 5. Definition of done (checklist for every task)
- [ ] Requirements listed (including assumed-missing ones) in the task notes
- [ ] Implementation clean, no hardcoded values, no business rules of __SYSTEM_NAME__
- [ ] Dev (local) and prod configurations both handled and tested
- [ ] All statuses and all error cases mapped and tested
- [ ] Unit tests per file/function; coverage gate green
- [ ] `npm run verify` green (build, smoke, loop included)
- [ ] `.claude/Integration.md` updated
- [ ] Commit, push branch, open PR
