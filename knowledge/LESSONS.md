# LESSONS — what twelve agent sessions on a multi-project monorepo taught (generalized)

> Distilled from the session transcripts and the per-project memory files of a system built end to end by AI agents: a Node/Express/Mongoose/Redis/Socket.IO/BullMQ backend, a React 19 + Vite admin panel, two Kotlin Multiplatform apps (Android + iOS), five TypeScript SDK packages (ports + adapters), with a backlog tool, hooks and a four-role review. Each lesson is one or two lines with the **why**. No facts of the source system (names, hosts, ids) are kept; they would be wrong for the next one.
>
> How to use: the SYSTEM_SETUP engine copies this file into `<workspace>/.claude/tools/` reference or links it from the workspace `README.md`; agents read the group that matches their task, never the whole file. `PLAYBOOKS.md` turns the recurring ones into step lists.

## 1. Workflow & tokens
- Auto-loaded files (root `CLAUDE.md`, rules, roles, hooks, session, memory, the project's `CLAUDE.md`) are never read with a tool — they are already in context; re-reading them is pure token waste and was the largest avoidable cost.
- Backlogs are read only through the tool (`tasks.py next|show|set|board|blocked|check`); a 400-row table read whole costs more than the task it introduces.
- Requirements are read by heading (`grep -n "^### S07"` then `sed -n`), never a PRD/BRD whole; the task row names the sections and operation ids to read.
- One project per session: only that folder's `CLAUDE.md`/session/memory load; cross-project facts live in `INTEGRATION.md` §1–§6 and root memory.
- Write acceptance criteria first, in the project's session block, naming PRD §/BUSINESS_DOMAIN §/operation ids — reviews and tests are checked against that list, not against memory of the conversation.
- Order verification cheap → expensive: static checks and host unit tests first, the full multi-variant gate once per batch, device/browser runs once per backlog; the 15–40 minute gate is then rarely wasted.
- Batched verification (write five tasks, verify once) saved hours; each block stays `Loops: 0/1` / `Review: PENDING` until the batch run actually happened.
- Never record a loop or review as passed when it did not run, even when a hook nags; honest session records are the only way the next session knows what is verified.
- Report coverage gaps as their own list ("not checked: RTL, dark, iOS, landscape") — "gate passed" is not "seen on a device".
- Run every gate quietly and read only its summary/tail; open the full log only on failure. Never grep-filter a gate's output as the pass signal: a filtered pipe once hid a failing step (exit 2, no lines).
- Chain build + install + device steps into one terminal command when possible: one wait and one result instead of many polling round trips.
- Treat an agent's "passed" as a claim until the orchestrator re-runs it or reads the diff; agents reported green runs that never compiled (sandbox without Gradle) or that were skipped.
- Read the risky parts of a diff yourself before merging: shrinker/keep rules, manifests, build settings, lockfiles — they compile cleanly and break at runtime (one R8 change hid a release tab bar).
- When a script you wrote fails, suspect the script first (wrong task name, zsh word splitting, BSD vs GNU `sed`, prettier re-wrapping your edit anchors); several "failures" were tooling, one committed conflict markers.
- Keep session files to current + last two blocks and memory to one line per finished task; both load every turn, and stale memory lines contradicted later behaviour.
- Files ≤ 300 lines (code, tests, locales) — small files are cheaper to read and review in every later session; enforce the limit in the gate.
- Brief subagents tightly (goal, files, what is ruled out, scope, report length) and run one per feature sequentially; six parallel agents burned ~1.6M tokens and hit the usage limit mid-run with work uncommitted.

## 2. Git, branches and masters ↔ main sync
- Branch per task from the freshly fetched project master, created with `git branch --no-track <name> origin/<master>` (the sandbox cannot write `.git/config`, so `-u`/tracking fails halfway); check `git branch --show-current` before the first edit.
- PRs target the project master, never `main`; the owner merges masters into `main`. If a master is behind `main`, merge `main` into it by PR first — otherwise the master → `main` PR cannot merge.
- Conflicts between masters and `main` happen almost only in shared bookkeeping: the generated board, backlog rows, root session index. Keep both sides, then regenerate the board from the backlogs (`tasks.py board`); never hand-merge a generated section.
- Resolve on a dedicated sync branch (`chore/sync-main-into-<master>-N`), locally, before opening PRs: conflicts show early, hosted merges take minutes each, and the masters stay clean.
- When several masters conflict repeatedly, merge them into one integration branch off `main` and resolve once instead of re-resolving the same churn per master.
- After a conflict resolution, grep for `<<<<<<<` and for missing backlog rows before committing; a batch resolution once committed markers silently.
- Before starting a task whose backlog rows sit next to a just-merged task's rows, merge the updated master into your worktree first — neighbouring rows in the same table conflict for sure.
- Keep each PR to its own project's files; a branch that picked up an unrelated commit is rebuilt clean, not merged — cross-project commits leak into the wrong master and deploy.
- A merge that needs new env vars must wait until the hosting environment has them; merge into the masters meanwhile — an auto-deploying branch broke the running service, sometimes with the old version silently serving.
- After a status-changing merge, propagate: rows DONE, rows stuck at IN REVIEW fixed, new rows for discovered gaps, board regenerated — stale backlogs made blocked work look ready and ready work look blocked.
- `tasks.py set <ID> DONE` is the only way to unblock dependents in other projects (BLOCKED → TODO) and rewrite the board; commit those file changes with the task.
- A gitignore pattern `reports/` also matched `src/**/reports/` and two feature folders were never committed: anchor patterns (`/reports/`) and run `git status --ignored` after adding a feature.
- Never commit secrets: ignore credential files by pattern, never use `user:pass@host` URLs or secret-shaped literals in tests (`'a'.repeat(48)` instead) — scanners flag even placeholders and a flagged commit stays in PR history.

## 3. Parallel agents & environment
- One worktree per agent (`.claude/worktrees/<agent>`, git-ignored) and one agent per master; hooks resolve the checkout from the command's `cwd`, so each worktree is judged on its own branch.
- One heavy gate at a time per machine: concurrent Gradle/Xcode/npm builds collide on the shared daemon and caches (`Timeout waiting to lock …`, out-of-memory, 95 % disk). About one build-heavy agent per app is the practical limit.
- Never stop or kill shared daemons (Gradle, emulators, a local server another agent tests against); finish or hand over. Do stop leftover command-line daemons before an IDE sync — several daemons competing for memory failed syncs even after raising the heap.
- Commit small and often, and always before a long build: sessions are dropped by `ECONNRESET`/DNS errors and usage limits, agents stall after ~10 minutes without progress; committed work in the worktree survives, uncommitted work is rescued by hand.
- Poll long builds with short reads (background command or terminal tab + `tail`), never block one turn on a 30-minute build — blocking waits looked like stalls and timed out the agent.
- A dropped agent is resumed in its own worktree on its own branch; if it cannot be resumed, a fresh agent continues there with the commits and uncommitted files intact.
- Watch disk before each heavy round: remove merged worktrees (unlink shared dependency symlinks first), delete only your own DerivedData/Kotlin outputs; a full disk produced "no space" gate failures and truncated binaries that looked like link errors.
- Terminal panel tabs are limited (~6) and echo their whole screen when read or closed: one tab per long process, close after use, keep output short.
- The sandbox cannot bind local ports (EPERM on listen), run `gh`, write `.claude/hooks/`, `.claude/settings*.json` or `.git/config`: send those steps through the Terminal panel, say so in the report, and classify EPERM-on-listen test failures as sandbox noise before judging the code.
- Pushes/merges made through the terminal bypass the Bash guard hook, so the `Loops: 1/1` + `Review: PASSED` lines must be true and written before them; the guard reads `session.md` before the command runs — write the block in one call, push in the next.
- After inspecting another agent's worktree, move your shell back to the main checkout on a master; the Stop hook judges the current branch and misfires on someone else's unfinished task branch.
- Never run two e2e suites, or e2e and a preview server, on the same port; a preview started from a shared config may serve the main checkout rather than your worktree — serve the worktree yourself on its own port.
- Builds run from a real terminal, not the sandboxed agent shell: it could not write `~/.gradle` and blocked the SDK/Maven hosts, so "done" was once claimed without a compile. Decide early where builds run.
- Maven Central 429 rate limits in CI/runners: point the build at a mirror.
- The system `python3` may be old (3.9): policy/tool scripts use `from __future__ import annotations` for `X | None`, or they work on dev machines and fail elsewhere.

## 4. Server (Node/Express/Mongoose/Redis/Socket.IO/BullMQ)
- Generate the OpenAPI from the same validation schemas, mount every router through one helper, and fail a test on stale generated files, routes without docs or docs without routes — otherwise clients integrate against a drifted contract.
- Keep a per-namespace contract fingerprint + version with a client-impact note; a test fails on any change not recorded, so breaking changes cannot reach clients unannounced.
- Generated spec gotchas that bit clients: optional objects omitted instead of empty, id patterns no real id matches, idempotency headers missing from one namespace — check the spec against a real response before a client ships.
- Status changes are an atomic compare-and-set in the repository (`transition(id, fromStatuses, set)`), used by every path that can settle the same record (client verify and webhook) — the main defence against double-settle/double-refund races.
- Take Redis locks over every contended key (multi-key), pass the domain "busy" error into the lock helper and re-validate the rule inside the lock; checks made before the lock are stale.
- Side effects (sockets, notifications, refunds, ledger, jobs) go through injected hook ports defaulting to no-op and never throwing — services stay testable and a failing side effect cannot roll back the main write.
- Job queue behind a scheduler port, deterministic job ids from domain parts (`kind.entityId.offset`), plus a startup `reconcile()` — rescheduling is idempotent and jobs lost in downtime are rebuilt.
- Bind the socket hub late through a relay the services hold; services exist before the socket server and late binding avoids the circular dependency.
- Money as integer minor units; round a percentage once on the total and derive the other part by subtraction — two separately rounded parts drift and no longer sum.
- Pass the time zone explicitly to every date helper, use half-open ranges, define DST gap/overlap behaviour — closed ranges made back-to-back slots conflict.
- Rate limiter as one Lua script; sensitive limiters (OTP, login, payments) fail closed, only the global one fails open — a Redis outage must not mean unlimited login attempts.
- Normalize every Redis outage signature (connection closed, command timed out, max retries, offline queue) to one 503 error type, or each surfaces as a differently shaped 500.
- Express 5: start with `http.createServer(app).listen` — `app.listen` reports a port-in-use through its callback and startup failures pass unnoticed.
- Mongoose: conditionally-required fields use `required: function(this){…}` (custom validators do not run on `undefined`); with `autoIndex: false` in production, create indexes at startup from a central model list and test that every model is in it.
- ioredis: `quit()` not `disconnect()` on possibly-closed clients (a 2 s timer keeps Jest hanging); `duplicate()` for subscribers and BullMQ workers with `maxRetriesPerRequest: null` and no command timeout — blocking commands break under API-client settings.
- Keep `req.rawBody` only under the webhook prefix (signatures need raw bytes; everywhere else wastes memory); retry unique-reference generation only on a duplicate-key error for that field.
- Settings cached in Redis with a version compare-and-set and a default fallback (with warning) on invalid stored values — stale writers cannot overwrite newer values and one bad row cannot crash the app.
- Readiness probes never depend on third-party providers — a vendor outage must not take every instance out of rotation.

## 5. Admin web (React + TypeScript + Vite)
- Every external dependency behind a domain interface with remote and mock implementations chosen by one env switch (`VITE_DATA_SOURCE`), the mock compiled out of prod by a build-time define and a bundle check that fails if dev-only names appear in a prod chunk.
- The mock is a fake `fetch` transport under the real HTTP client, not a mock repository — page tests then cover envelope validation, refresh and error mapping; give it per-route closure state, a scenario switcher (`serverError`, empty, slow), server-shaped 409/422 errors and dates relative to now (fixed dates go stale).
- A test that every contract operation has a mock fixture (with an explicit exempt list) — otherwise new operations fail silently in dev.
- Contract sync (`api:sync`): committed OpenAPI copy, DTOs as lazy schema factories + types, an `OPERATIONS` map with stable ids from method + path; generated code excluded from lint/format/coverage/size/hardcode checks. Hand-written DTOs drift; hand-overridden generated patterns (id regexes) hid contract bugs — fix the server contract and add a test that fails on overrides.
- Generate a doc of consumed operations checked by the gate (with an exemptions file) and tests that compare enum-driven UI (status badges, error-code catalog) with the contract's enums and codes — new server values otherwise render as raw strings.
- Branch on error `code`, never on message text; show the server's localized message when present.
- Every list paginated on the server; list state in the URL (`page`, `pageSize`, `q`, `sort=key:dir`, one param per filter) through pure parse/serialize functions and a multi-filter setter — deep links, back button, no double fetch.
- Sessions: tokens in memory mirrored to `sessionStorage` (schema-validated at start, never `localStorage`); one single-flight refresh on 401 then sign-out with a shown reason — parallel 401s otherwise start several refreshes and sign the user out.
- Wrap lazy routes in a loader that reloads once on a failed chunk (with a timestamp guard) — after a deploy, open tabs request chunk files that no longer exist.
- RTL default with logical CSS only (`inline-start/end`), `minmax(0, 1fr)` grids and `position: relative` on scroll boxes — tables and visually hidden/absolutely positioned children made the page scroll sideways; one viewport hook sets `data-bp`/`data-orientation` on `<html>` so components and e2e read one breakpoint.
- Locale files split per area under 300 lines, large areas lazy, tests for key parity/empty values/placeholder mismatches; no dots or plural suffixes in keys.
- Bundle budgets (entry, per-chunk, CSS, total JS in prod) — the shell sat at 99.8 % of its entry budget, so small imports broke the build; measure before adding to the shell.
- Vite: files imported by `vite.config.ts` use relative imports with `.ts` extensions, `vite preview` needs `--mode <variant>`, CSP `font-src` needs `data:` (inlined small fonts); commit only placeholder `.env.dev`/`.env.prod` with a schema that names missing keys only.
- Unit tests cannot see CSS layout: measure widths/positions in a real browser (a drawer rendered 185 px wide with every test green) and return one compact JSON of measurements instead of screenshots.
- When the browser pane is hidden, clicks and `.focus()` do not fire React handlers — use `form.requestSubmit()` and dispatched `focusin`/`mouseover`.
- Run axe in both languages and lock WCAG AA contrast in a token test (4.5:1 on every surface) — theme regressions get caught without a manual pass.

## 6. KMP Android
- Four variants (dev/prod × debug/release) compile on every PR; release stays R8-minified with explicit keep rules and a test per reflective lookup — release-only breakage otherwise shows up in prod.
- Lint and Kotlin treat warnings as errors: deprecated Compose APIs fail the build; do not build with `-q` when checking warnings (quiet hides `w:` lines) — grep `^w:` from a full log.
- KMP library modules have no `compileDebugKotlinAndroid`; use `:app:assemble<Flavor><Type>` or `:<module>:testAndroidHostTest`.
- Dev gets its own application-id suffix; Firebase config is tied to the id, and every `pm clear`/launch targets the right package.
- Apply the crash-reporter Gradle plugin in the app convention plugin — missing it aborted the app at startup and skipped mapping uploads.
- Detekt rules that bite in bulk: line length 140, complexity ≤ 15 (mappings as tables, reducers split into `handleX(event): Boolean` chained with `||`), `rememberUpdatedState` for lambdas in `LaunchedEffect`, composable parameter order, `modifier = Modifier` on private composables, present-tense lambda names, new CompositionLocals added to `allowedCompositionLocals`, `ignored` as the swallowed-exception name.
- `/*` inside KDoc or strings (`core/*`, `"image/*"`) opens a nested comment — compile error or policy-lexer hit; build such values from constants.
- Baselines (detekt, policy) are ratchets that only shrink, or stay empty from day one on a new app — the second app proved an empty baseline is achievable.
- Pin transitive KMP libraries to the version the HTTP client pulls (e.g. kotlinx-datetime); a lower catalog version mixes klibs and causes `IrLinkageError` on iOS only.
- MVI-delegate ViewModels: `onStart` re-runs on every re-subscription, so guard one-shot loads; read the delegate's `uiState.value`, not the lagging `stateIn` value; tests keep one collector in `backgroundScope` with `UnconfinedTestDispatcher`.
- Koin `viewModelOf` cannot resolve constructor lambdas or defaults of non-Koin types — use `viewModel { X(get(), …) }`; a feature `di` module referencing core types declares those dependencies itself.
- Generated DTOs/operations from OpenAPI (`apiSync --check` in the gate, generated code excluded from detekt/policies) and fixtures from the same spec plus captured real responses; fixtures need value hints (unique ids per list item — lazy lists keyed by id crash on duplicates; `allOf` responses generate as `data: null` and are hand-written).
- Policy scripts cover what detekt cannot: hardcoded user-visible strings, `https://` literals, secret-named constants, every screen tracking itself, every navigated route registered. Compose string resources print `\'` and `%%` literally; counted text uses `<plurals>` per language.
- Emulator QA: pass `-s <serial>`/`ANDROID_SERIAL` with several emulators; journey = `pm clear`, launch, `screencap`, `dumpsys activity activities | grep topResumedActivity`, logcat `FATAL EXCEPTION|Caused by`; rotation via `accelerometer_rotation 0` + `user_rotation 1`; `geo fix` does not feed the fused provider (`cmd location … add-test-provider`); keyboard closes with keyevent 4; low-RAM AVDs ANR under load and the emulator clock drifts.
- Local stack from the emulator: host `10.0.2.2`, an untracked debug manifest allowing cleartext (never committed), `adb reverse` for object storage — do not weaken the shipped network security config.

## 7. KMP iOS
- xcconfig: `//` starts a comment, so URLs are written `https:/$()/host` or the value is silently cut to `https:`; an empty-value regex in a generator once ate the next line (the prod bundle id) — test generators on real xcconfig text.
- Four configurations (Debug/Release × Dev/Prod), one shared scheme per environment, xcconfig → Info.plist → one `AppEnvironment`; a git-ignored `Local.xcconfig` overrides for local-stack runs (ATS-allowed IP there).
- Placeholder Firebase plist keys crash iOS at launch in Installations key validation (and throw on Android) — catch it in providers; get real dev files before simulator QA.
- Sign simulator builds ad hoc (`CODE_SIGN_IDENTITY=-`); `CODE_SIGNING_ALLOWED=NO` breaks the Keychain, so secure storage fails and the app looks signed out — a build flag that looks like an auth bug.
- K/N: never call a suspend function inside the argument list of an ObjC call (earlier arguments are converted and raw pointers kept across the suspension → SIGSEGV in `objc_retain`); load values first, then build ObjC objects in a non-suspend function.
- K/N with `-Werror`: `String as NSString` rejected, `NSData.create` needs `@OptIn(BetaInteropApi::class)`, `CFBridgingRetain` is in `platform.Foundation`, MapKit delegate overloads need `@ObjCSignatureOverride`.
- Kotlin types Swift implements (bridges) must come from a module exported from the shared framework (`export(project(...))` + `api`), or Swift cannot see the interface.
- Adding an SPM product without Xcode needs four pbxproj entries (PBXBuildFile, Frameworks phase, packageProductDependencies, XCSwiftPackageProductDependency); a partial patch builds locally and fails to link.
- The iOS gate (4 configurations + simulator K/N tests) takes ~10 minutes and much disk: delete DerivedData/Kotlin outputs between configurations on a full disk and keep a skip flag for Android-only runs.
- A cold-start timeout against a sleeping remote dev API must show an error + Retry, not a crash; a Swift-facing name (`MainViewController`) may need a detekt exception.

## 8. SDKs / packages (ports + adapters)
- Lazy-load heavy vendor SDKs and use `require()` in the CJS build rather than native `import()` — native dynamic import fails under Jest/ts-node in consumers, found only when wiring the SDK into the server.
- Gate each release with a pack → install into a temp project → call through `require` and `import` smoke test; unit tests cannot catch a broken `exports` map or dual build.
- Map every vendor status explicitly; unknown values go to `UNKNOWN` (logged raw, never success); typed errors carry `code`, `retryable`, `cause` and secret-free `details` — treating unknown as success is how a payment gets marked paid.
- Idempotency: same key + same request → first result; same key + different request → conflict; failed send forgotten so the caller retries; short TTLs because a crashed in-flight record blocks the key.
- Retry only safe calls, reuse one vendor idempotency key across retries, never retry a non-idempotent POST (refund) — look up by merchant reference first; never retry a malformed 2xx; cap retry-after hints.
- A redacting logger that hides keys containing `code`/`token`/`key` also hides error codes — log them under a neutral field.
- Prod mode strict at construction: refuse fakes, dry-run, http endpoints, in-memory stores; require secrets; check the credential's project id matches the configured one; name only the bad option keys in errors.
- A loop test per SDK (hundreds of flows, ~20 concurrent, duplicate keys, injected transient failures) asserting exactly-once effects, no leftover keys/objects, flat heap — unit tests do not show leaks or idempotency races.
- Enforce what the vendor cannot (presigned PUT cannot cap size) at a confirm step: magic bytes + size, delete on failure; never trust client-declared type or size.
- The server keeps its own port and a thin adapter mapping SDK errors (outage → 502/503, caller bug → `RangeError`), so swapping or dropping an SDK never touches domain code; a paused feature keeps the port with a `disabled` provider production selects explicitly.
- Watch ranges that differ between vendor and consumer settings (vendor accepts 4–6 digit codes, admin setting allows 10) — a legal setting then causes a 503 on every request.
- Sibling `file:` SDK dependencies force the Docker build context to the repo root and an `ensure-sdks` script that builds them first.

## 9. QA & e2e
- A local full stack (database, cache, object storage, server with fake providers) when the shared remote is stale or broken — the code under test is identical and QA stops waiting.
- Before blaming the client, check the remote directly: health vs a new endpoint (404 = old deploy), seed counts, free-tier cold start and blocked outbound ports — several "app bugs" were an old server or missing data.
- Device/browser journeys once at the end of a backlog across every locale/direction, theme, orientation and font scale — one pass catches cross-cutting defects cheaply; per-task device runs are slow.
- Crashes, contract gaps and server defects found during client journeys become new server tasks with tests, tracked separately from client fixes — client QA was the main source of server bug reports.
- Rule out tooling artifacts before filing bugs: clock skew, adb dropping characters, low memory, a stale install, an emulator that will not rotate, a stale build older than your edits.
- Measure layout bugs with numbers (widths, negative RTL offsets, width sweeps) and tighten weak e2e assertions until they fail on the known bug — an e2e that passes with the bug present proves nothing.
- Server tests: a fake model whose operator support grows (record its gaps), one Redis logical DB per worker with `flushdb` never `flushall`, repeated socket emits (the adapter subscribes asynchronously), concurrency tests against the service not HTTP (route limiters throttle the test), tokens re-signed under the real clock, single-use proofs never reused across calls.
- Web e2e: one Playwright run at a time (port sharing), selectors scoped to a labelled container with `exact: true`, `selectText()` instead of Ctrl+A on macOS, client-side navigation with one token in real-server sweeps (reloads hit per-IP limits); `waitFor` hangs under fake timers — `act(() => vi.advanceTimersByTimeAsync(n))`.
- Property tests with a seeded PRNG + independent oracle; security checklists as tests (every admin route rejects a missing admin token).
- On red CI replay in a clean clone with `npm ci` first; jobs dying in seconds with no steps are a platform/billing problem. Mutation loops run in a separate worktree — interrupted runs leave untracked mutations.
- A structured diagnostic log around external flows (sent, timing, error codes) separates app bugs from provider/carrier delivery problems in one read.

## 10. Hosting, env and secrets
- Env validated by a fail-fast schema; a test that every schema key appears in `.env.example`; an `env:check <file>` that validates key names only — config should fail at deploy, not on the first request.
- A hosted dev environment that runs `NODE_ENV=production` gets full prod strictness: tell environments apart by credentials (separate vendor projects, buckets, keys) and warn at startup when test-mode keys run in production mode.
- Some hosts block outbound SMTP: keep an HTTP-API email adapter behind the same channel port; provider "From" must equal the authenticated account and daily caps apply.
- Behind an HTTP proxy, some vendor SDKs ignore `HTTPS_PROXY` and HTTP/2 transports cannot be proxied — expose injectable agent/legacy-transport options.
- From the host, a replica-set database container needs `directConnection=true`, or the driver chases internal hostnames.
- Config values the owner must set are requested by key name only; secrets never travel through chat and env values are never printed — tell owners to paste into the host and rotate anything exposed.
- A change that needs new env keys ships to masters first and to the deployed branch only after the owner confirms the keys; the deployed branch is the only place a merge is a deploy.
- Firebase (or equivalent) client files with live keys live outside git; committed placeholders must build with the SDK off; real dev files are an owner input listed as a PENDING row.

## 11. Owner decisions (how to handle them)
- Record decisions as dated one-liners in a "replace, don't append" memory and update the domain source of truth in the same PR — later sessions neither re-ask nor contradict.
- Everything only the owner can supply goes into one short numbered list at the end of each report with exact steps; the rows stay PENDING/BLOCKED with the blocker named — owners act on a checklist, scattered asks get lost.
- Skip owner-blocked tasks instead of stopping the backlog; keep an explicit "open questions / unverified against the real vendor" list with the safest default behind configuration.
- Build blocked work up to the external boundary with fakes or test triggers in place, record it as a deviation — the feature ships and is tested; only the delivery step waits for credentials.
- When a blocker is satisfied another way (an equivalent environment exists), add a DONE row for that and repoint dependents; leave the original owner task open so the record stays true.
- When a newer owner instruction contradicts an older backlog row, follow the newer one and ask for confirmation; when documents conflict, stop and ask instead of guessing; mark superseded documents `LEGACY — do not implement`.
- Make small reversible technical choices yourself and record them; escalate only costly-to-reverse, money/vendor or security trade-offs — waiting on every choice stalls the backlog.
- A fix that needs a protected path the agent cannot write (hooks, settings) is offered as an exact patch or run outside the sandbox with approval — rules and hooks stay owner-controlled.
- Process permissions are written as explicit conditional rules ("may self-merge only after the full local gate is green") and updated when the owner changes them.
- Verification cadence decisions (one loop; batched every five; local gates, no CI; e2e only on request) are recorded with their date in rules and memory so hooks and agents enforce the same thing.
