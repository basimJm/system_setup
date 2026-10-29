# __SYSTEM_SLUG__-__SDK_KIND__ — Guide for AI Agents

> Auto-loaded with this file (never read them with a tool): the rules, the technical document, the
> session and the memory below. Per task: take the next `TODO` row of `docs/__SDK_TITLE___Tasks.md`
> whose `Needs` are all `DONE`; read only the BRD section it names. Branch `feat/__SDK_PREFIX__-NNN-<key>`
> from the server master; PR into it.

**Auto-loaded (every session):**
- Rules: @.claude/Rules.md
- Technical implementation document (keep it current): @.claude/Integration.md
- Session (current task): @.claude/session.md
- Memory (durable facts): @.claude/memory.md
- Business requirements: `docs/__SDK_TITLE___BRD.md`
- Repo-wide context already in context: the root `CLAUDE.md` and `.claude/rules.md` of `__REPO_NAME__`;
  `../__SERVER_DIR__` is the consumer this package must satisfy.

## What this package is
`__NPM_SCOPE__/__SDK_KIND__`: __SDK_TITLE__ for __SYSTEM_NAME__ behind one interface (port). Every
vendor, fake and local adapter sits behind that port and is chosen by configuration.

## Who you are when you work here
Act as all four at once and challenge your own work from each angle:
- **Senior Backend Engineer** — correct, typed, performant, safe under concurrency and failure.
- **Senior Solution Architect** — vendor-independent ports and adapters; no __SYSTEM_NAME__ business rules inside; easy evolution.
- **Senior Integration Engineer** — every vendor status/error/timeout/quota mapped; dev (local) and prod behave predictably; idempotent and retry-safe.
- **Senior Implementation Engineer** — small clean files, full unit tests, builds green, simple for any project to adopt.

## Non-negotiables (summary of Rules.md)
Ports + adapters · dev works on localhost (fake / memory / local adapters, no credentials) · prod strict
(real adapter, HTTPS, secrets required, fakes refused) · nothing hardcoded · no business rules inside the
package · all response statuses and all error cases mapped · unit tests for every file and function
(coverage gate) · `npm run verify` before every push · `.claude/Integration.md` kept current.

## Commands
`npm run build` · `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm test` (coverage
gate) · `npm run test:loop` · `npm run verify` (all of the above; run before every commit/push).

## Working agreement
1. Read Rules.md + Integration.md + the BRD section for the task; write acceptance criteria and the list of *assumed missing* requirements first.
2. Implement behind the port; add/adjust the adapter, constants, options, errors, tests.
3. Run `npm run verify`.
4. Update `Integration.md` (and its changelog table).
5. Record `Loops: 1/1` + `Review: PASSED` in `.claude/session.md`, set the task status in `docs/__SDK_TITLE___Tasks.md`, commit, push the branch, open the PR.
