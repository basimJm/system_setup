# __SYSTEM_NAME__: facts

> Read on demand through `scripts/recall.py`; moved here so the loaded memory stays small.

## Repo and flow
- Monorepo `github.com/__OWNER_GITHUB__/__REPO_NAME__`. Masters: `main` (owner merges into it) and __MASTERS_LIST__ (one per project family; SDKs ship with the server and use its master). Task branches `feat/<prefix>-NNN-<key>` from the fresh master; PRs target the master; PRs are merged after the local gate once the owner grants the autonomous flow, then the next ready task starts.
- Backlogs: one per project/SDK (`.claude/projects.json` lists them); read only through `python3 scripts/tasks.py next|show|set|board|blocked|check`. `set <ID> DONE` unblocks dependents in other projects and rewrites the board in `INTEGRATION.md` §7. Tests: `python3 -m unittest scripts/test_tasks.py`.
- Sessions/memory: root `.claude/session.md` = index of all projects; the working session block lives in the project's `.claude/session.md`. Hooks read all of them (`_common.session_files()`); `Loops: 1/1` is the rule. Hook tests: `python3 .claude/hooks/test_hooks.py`.
- The sandbox cannot write `.claude/hooks/` or `.git/config`, bind ports or run `gh`: patch hooks and push/merge through the Terminal panel (rules §3.12); create branches with `git branch --no-track <name> origin/<master>`. Check the system `python3` version before using newer syntax (`from __future__ import annotations` for `X | None` on 3.9).
- Requirements: `<project>/docs/` (PRD > BRD > Design Script > design files). `BUSINESS_DOMAIN.md` = schemas, enums, rules, state machines, permissions, jobs, settings, error codes (money = integer minor units; UTC stored, business time zone computed).
- Contract = the generated server OpenAPI in `__SERVER_DIR__/docs/api/openapi.*.json` (+ Postman). No hand-written contracts folder. Clients regenerate DTOs from it (admin `npm run api:sync`; apps their `apiSync` task).

## Key decisions (owner; date each one)
- _(auth / one-time-code provider and its dev fake)_
- _(real-time, push, jobs, storage, email, analytics providers — one line each with the env key names, never values)_
- _(payments phase 1 vs later phases)_
- _(verification cadence: batched every five tasks + end-of-backlog gates; one verification loop; local gates vs CI; e2e only on request)_

## Open owner inputs (block integration)
- _(hosting, gateway + sandbox, managed database/cache tiers, error tracking, package registry, push registrations, store accounts/signing)_
