# **ADMIN_DIR** — Session

> Loaded on every turn while working in this folder. Keep the current task block + the last 2 blocks (git history keeps the rest). Next task: the first `TODO` row of `docs/Admin_Tasks.md` whose `Needs` are `DONE` (or `python3 scripts/tasks.py next admin` in a monorepo).

## Integration status (one glance)

- Consumes every `/admin/v1` operation of `../__SERVER_DIR__/docs/api/openapi.admin.json` through the generated contract (`npm run api:sync`); mock transport on fixtures in dev; realtime `/admin` namespace client wired (`item.updated`, `alert.created`).
- Gate: `sh scripts/gate.sh` + browser UI check before every commit; no hosted CI.

## Current task

### ADM-008 — First product module

- Branch: `feat/adm-008-<module>`
- Status: TODO
- Acceptance criteria (PRD P0x, operations …):
  - [ ] …
- Tests: …
- Loops: 0/1
- Review: PENDING
- Notes: the items module (`src/{domain,data,presentation}/items`, `tests/items.test.tsx`) is the reference to copy.
