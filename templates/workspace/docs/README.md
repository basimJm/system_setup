# Writing the documents of a project (PRD, BRD, Tasks, project `.claude/`)

Every project folder carries `docs/` with three documents and `.claude/` with four small files. Agents read them **by section** (grep the heading, read the range), so headings are the API of a document: stable, numbered, one topic each.

| File | Template | Purpose | Who reads which part |
|---|---|---|---|
| `docs/<Name>_PRD.md` | `templates/PRD_TEMPLATE.md` | Behaviour source of truth: screens (`### S07 …`), flows, states, copy keys | the task row names the `S`/`§` ids to read |
| `docs/<Name>_BRD.md` | `templates/BRD_TEMPLATE.md` | Business requirements, non-functional needs, phases, open owner decisions | architects and the backlog author |
| `docs/<Name>_Tasks.md` | `templates/TASKS_TEMPLATE.md` | The backlog: one row per task, read only through `scripts/tasks.py` | `tasks.py next/show/set` |
| `CLAUDE.md` | `templates/PROJECT_CLAUDE_TEMPLATE.md` | Project rules, layers, gate command, conventions (loaded in that folder) | every turn in the folder |
| `.claude/session.md` | `templates/PROJECT_SESSION_TEMPLATE.md` | Current task block + last 2 | every turn in the folder; hooks |
| `.claude/memory.md` | `templates/PROJECT_MEMORY_TEMPLATE.md` | Durable facts of the project | every turn in the folder |
| `.claude/Integration.md` | `templates/PROJECT_INTEGRATION_TEMPLATE.md` | What this part exposes/consumes, mocks, env keys | cross-project tasks |

Precedence inside a project: **PRD > BRD > Design Script > design files**. A conflict is a question for the owner, not a judgement call. `BUSINESS_DOMAIN.md` at the root wins for schemas, enums, settings keys and error codes.

## Backlog table format (parsed by `scripts/tasks.py`)
```
| ID | Title | Branch | Needs | Status | Notes |
|---|---|---|---|---|---|
| SRV-001 | Scaffold | `feat/srv-001-scaffold` | — | TODO | PRD §1; ops: none |
```
- `ID` = `<PREFIX>-NNN` (optional letter suffix `004a` for a split row), prefix from `.claude/projects.json`; unique across the repo.
- `Branch` = `feat/<prefix-lower>-NNN-<key>`; `tasks.py` strips the backticks.
- `Needs` = other task ids (any project) that must be DONE first; a header starting with `Needs`, `Server`, `Depends` or `Blocked by` is read as a dependency column (several are allowed, e.g. `| Needs | Server (SRV) |`).
- `Status` semantics: `TODO` ready when its needs are DONE · `IN PROGRESS` branch exists · `IN REVIEW` PR open · `DONE` merged into the master · `BLOCKED` waits on a task of another project (`tasks.py set <dep> DONE` flips it back to TODO automatically) · `PENDING` waits on the owner (the Notes cell must say what; `check` fails otherwise) · `CANCELLED`.
- `Notes` names the PRD sections and OpenAPI operations to read, and for PENDING rows the owner input (`**owner input**`).
- `tasks.py check` fails on duplicate ids, unknown statuses, unknown dependencies, BLOCKED rows whose needs are all DONE, TODO rows waiting on another project, PENDING rows without a note.
- Pipes inside backticks (e.g. `` `fake|real` ``) are safe; any other `|` in a cell breaks the row.

## A feature across modules: the packet
`python3 scripts/line.py new <name>` writes `features/<name>/PACKET.md` from `features/PACKET_TEMPLATE.md`. Two pages at most: decisions, contract change, design, docs to update, and one `## Module:` section per module with its `Tasks:` and acceptance criteria. Workers get only this, so a decision missing here is a decision they will stop and ask about. `line.py check <name>` validates it.
