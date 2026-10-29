# **SERVER_DIR** — Session (current task + the last 2 blocks)

> Loaded on every turn in this folder. Keep only the current task block and the two before it; older blocks go to git history. Next task: `python3 scripts/tasks.py next server`.

### SRV-001 — Server scaffold from the SYSTEM_SETUP template

- Branch: `feat/srv-001-scaffold`
- Status: DONE
- Acceptance criteria (docs/BUSINESS_DOMAIN.md §1–§11):
  - [x] `npm ci && npm run verify` green on the generated project
  - [x] Sample `items` feature serves the three namespaces; OpenAPI + Postman generated; contract guard recorded
- Tests: `npm test`
- Loops: 1/1
- Review: PASSED (SE ✔, Mobile N/A, Architect ✔, QA ✔) — generated scaffold; no product rules yet.
