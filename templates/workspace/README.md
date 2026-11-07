# __SYSTEM_NAME__ — Workspace (how agents and people work in this monorepo)

> Generated __DATE__ by SYSTEM_SETUP for `github.com/__OWNER_GITHUB__/__REPO_NAME__`. This file is for humans and for an agent that lands here without context. Agents in a session work from `CLAUDE.md` + `.claude/*` (auto-loaded) and never read this file twice.

## 1. What is in the root
| Path | Purpose |
|---|---|
| `CLAUDE.md` | Hard rules and the task flow, short because every session loads it. The business, repo map, conventions and open decisions are in `system-overview.md` (with the lessons, below). |
| `.claude/rules.md`, `roles.md`, `hooks.md` | Mandatory rules (token efficiency, delivery, batched verification, parallel agents), the four review roles, the hook table + task block template. Read on demand. |
| `.claude/session.md`, `memory.md` | Open repo-level task blocks; what every session must know. Project-level session and memory live in each project. The map printed at session start shows every project's state. |
| `scripts/map.py`, `recall.py` | The whole system in a few hundred tokens from the real state, and details on demand as `path:line`. |
| `scripts/line.py`, `qa.py`, `usage.py`, `features/` | The feature line: a packet, thin workers per module, QA without a model, one reviewer, merge by script. `usage.py` measures tokens against the targets. |
| `.claude/projects.json` | **The registry.** Every project/SDK: key, prefix, folder, master branch, backlog, session/memory/integration files. `scripts/tasks.py` and the hooks read it; nothing else lists projects. |
| `.claude/settings.json` + `.claude/hooks/*.py` | Claude Code hooks: branch guard, hardcode scan, session start, prompt reminder, stop review. Tests: `python3 .claude/hooks/test_hooks.py`. |
| `.claude/skills/` | Vendored Android performance skills (profiler, Compose performance, ANR audit, R8 analyzer) with their license; read a `SKILL.md` before use. |
| `scripts/tasks.py` | The backlog tool (`next`, `show`, `set`, `board`, `blocked`, `check`). Tests: `python3 -m unittest scripts/test_tasks.py`. |
| `INTEGRATION.md` | How the parts talk: masters, contracts, edges, auth, real-time/push/jobs/storage, environments, the generated board (§7). |
| `BUSINESS_DOMAIN.md` | Single source for schemas, enums, rules, state machines, permissions, jobs, settings keys, error codes. |
| `docs/AGENT_PROMPT.md` | **Give this to your AI agent.** The filled prompt: business, projects, how to write PRDs/backlogs from `BUSINESS_DOMAIN.md`, then the per-task loop. `docs/BUSINESS_INPUT.md` holds the raw setup answers. |
| `docs/` | How to write a project's PRD/BRD/backlog and its `.claude/` files; the templates. |
| `__SERVER_DIR__/`, `__ADMIN_DIR__/`, apps, SDK packages (`__SYSTEM_SLUG__-<name>/`) | One folder per project (see `CLAUDE.md` §2 and `INTEGRATION.md` §1). |

## 2. How a session works
1. **One project per session.** `cd <project>`; only that project's `CLAUDE.md` + `.claude/{session,memory}.md` load on top of the root files. Nothing else is read up front.
2. **The tool gives the task.** `python3 scripts/tasks.py next <project>` prints the one ready task (ID, branch, needs, notes = PRD sections and operation ids to read). Never open a backlog whole.
3. **Branch from the project master**, never from `main`: `git fetch origin && git branch --no-track feat/<prefix>-NNN-<key> origin/<master> && git checkout feat/...`. `tasks.py set <ID> "IN PROGRESS"`.
4. **Task block** in the project's `.claude/session.md` (template: `.claude/hooks.md` §3) with acceptance criteria; implement + unit tests; project gate; one verification loop (`Loops: 1/1`); four-role review (`Review: PASSED`). Under the batched cadence (`rules.md` §3.13) the loop/review happen once per five tasks.
5. **PR into the master**, merge when green (if the owner granted self-merge), `tasks.py set <ID> DONE`, next task. Stop only on `PENDING`/`BLOCKED` rows and report them.

## 3. Branches: masters and `main`
- Masters: `main` (owner merges into it) and __MASTERS_LIST__. Every task branch starts from a freshly fetched master and its PR targets that master; nothing is committed on a master or on `main` directly; no force pushes, no `--no-verify`.
- SDK packages ship with the server and use its master.
- Sync direction: `<master>` → `main` (owner) and `main` → `<master>` (by PR, before a master that is behind can merge). Conflicts are almost always the generated board, backlog rows and the session index: keep both sides, regenerate the board with `python3 scripts/tasks.py board`. Procedure: `PLAYBOOKS.md` §4 (in the SYSTEM_SETUP knowledge folder).
- Hooks resolve the checkout from the command's `cwd`, so parallel agents work in `.claude/worktrees/<agent>` (git-ignored), one per agent, one build at a time per machine.

## 4. How projects talk to each other
- **Contract files, not conversations.** The server generates `__SERVER_DIR__/docs/api/openapi.<namespace>.json` (+ Postman) from its validation schemas on every endpoint change and commits them. Clients regenerate DTOs from that file (admin `npm run api:sync`, apps `apiSync`); their gates fail on drift. Nobody hand-writes a DTO or builds a screen on an endpoint the contract does not have.
- **`INTEGRATION.md`** is the map: who calls whom (§3 edges), what is mocked vs live, auth and real-time conventions, environments, and the live board (§7) with every project's counts and blocked rows.
- **Dependencies are backlog rows.** A client row that needs server work lists the server task id in `Needs` and starts `BLOCKED`; `tasks.py check` rejects a `TODO` row that waits on another project. When the server task is merged, `python3 scripts/tasks.py set SRV-NNN DONE` flips every dependent row (in any project) to `TODO` and rewrites the board — that is the only cross-project notification, so it is never skipped.
- **Owner inputs are `PENDING` rows** with the input named in Notes (`**owner input**: …`); `tasks.py blocked` lists them. Agents build up to the boundary with fakes and record the deviation.
- **Per-project `Integration.md`** lists what the part exposes/consumes, its fakes and env key names (never values); a task that adds an endpoint, event, port or key updates it in the same PR.

## 5. Status semantics (`docs/README.md` has the table format)
`TODO` ready when its needs are DONE · `IN PROGRESS` branch exists · `IN REVIEW` PR open · `DONE` merged into the master · `BLOCKED` waits on another project's task (auto-flipped) · `PENDING` waits on the owner (Notes says what) · `CANCELLED`.

## 6. Adding a project
Folder with `CLAUDE.md`, `docs/{PRD,BRD,Tasks}`, `.claude/{session,memory,Integration}.md` (templates in `docs/templates/`), one entry in `.claude/projects.json`, a row in `INTEGRATION.md` §1 and root `CLAUDE.md` §2, a master branch if it needs its own; then `python3 scripts/tasks.py check`, `python3 .claude/hooks/test_hooks.py`. Full steps: `PLAYBOOKS.md` §10.

## 7. Commands worth memorizing
```
python3 scripts/tasks.py next <project> | show <ID> | set <ID> <STATUS> | board | blocked | check
python3 .claude/hooks/test_hooks.py
python3 -m unittest scripts/test_tasks.py
```
