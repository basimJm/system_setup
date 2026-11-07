# SYSTEM_SETUP — prompt for an AI agent

Two prompts live in this file. **Part A** is given to an agent that has to create a new system with this tool
(copy it, fill the `<…>` placeholders). **Part B** (between the `AGENT_PROMPT` markers) is what the tool itself writes
into every generated repository as `docs/AGENT_PROMPT.md`, with the business answers and the project list filled in;
give that file to the agent that will work inside the new repository.

---

## Part A — Set up a brand-new multi-project system

You are setting up a brand-new multi-project system with the SYSTEM_SETUP tool and then configuring it for a specific
business. Work in this order; do not skip the tests; ask the owner whenever a `<…>` value below is missing.

### 1. The tool
- The tool lives at `<path to the system-setup repository>` (or clone `<git url of the repository that contains the tool>`
  and use its root folder as `<tool>`).
- Read `README.md` next to this file once (questions table, business file format, token contract).
- Run its tests first: `python3 -m unittest discover -s <tool>/tests -p 'test_*.py'` — all green or stop and report.
- The target folder must be **outside** the tool and empty: `<absolute target folder>`.

### 2. The business (collect these from the owner before running the tool)
| Value | Flag | Answer |
|---|---|---|
| System name EN / AR | `--name`, `--name-ar` | `<name>` / `<arabic name>` |
| Prefix (folders + task ids) | `--prefix` | `<PREFIX>` |
| Package root, npm scope | `--package-root`, `--npm-scope` | `<com.company>`, `<@scope>` |
| Parts | `--no-server`, `--no-admin`, `--app Name:slug[:arabic]` (repeat), `--sdk a,b` | `<which parts>` |
| URLs (scheme + host only) | `--dev-api-url`, `--prod-api-url`, `--dev-web-url`, `--prod-web-url` | `<urls>` |
| Apple Team ID, GitHub owner, repo name | `--team-id`, `--github-owner`, `--repo-name` | `<values>` |
| Business summary (~10 lines) | `## Business summary` | `<actors, what each app lets them do, how money moves phase 1 vs later>` |
| Default language, RTL | `## Default language`, `## RTL` | `<ar>`, `<on/off>` |
| Currency, minor unit | `## Currency`, `## Currency minor unit` | `<ISO code>`, `<unit, N decimals>` |
| Stored / business time zone | `## Stored time zone`, `## Business time zone` | `<UTC>`, `<IANA zone>` |
| Actors + permissions | `## Actors` | `<one per line>` |
| Core business rules | `## Core business rules` | `<numbered list>` |
| Entities + states | `## Entities and states` | `<Entity: STATE -> STATE ...>` |
| Scheduled jobs / reminders | `## Scheduled jobs` | `<one per line>` |
| Integrations | `## Integrations` | `<OTP, payments, push, storage, maps, analytics — or "decide later">` |
| Open decisions | `## Open decisions` | `<one per line>` |

Write the business answers to a file `business.md` with exactly those `## <field>` headings (or a `.json` with the
keys `summary, default_language, rtl, currency, currency_minor_unit, stored_time_zone, business_time_zone, actors,
rules, entities, jobs, integrations, open_decisions`). What the owner has not decided stays `TBD`; never invent it.

### 3. Generate
```bash
<tool>/SYSTEM_SETUP --yes --name "<name>" --name-ar "<arabic name>" --prefix <PREFIX> \
  --package-root <com.company> --npm-scope <@scope> --target <absolute target folder> \
  [--no-server] [--no-admin] --app <Name:slug:arabic> --sdk <a,b> \
  --dev-api-url <https://host> --prod-api-url <https://host> --dev-web-url <https://host> --prod-web-url <https://host> \
  --team-id <TEAMID> --github-owner <owner> --repo-name <repo> --business business.md
```
Then, inside the target: `python3 scripts/tasks.py check`, `python3 .claude/hooks/test_hooks.py`,
`python3 -m unittest scripts/test_tasks.py` — all green. Read the tool's report: no unresolved tokens, no sentinel
leftovers, `tasks.py check: OK`, git initialised with `main` + one master per project.

### 4. Configure the domain and the backlogs
Follow `docs/AGENT_PROMPT.md` in the generated repository (Part B below, already filled with the answers): fill
every TBD in `BUSINESS_DOMAIN.md` with the owner, write the PRD/BRD and the backlog of every project, rename or delete
the `items` sample feature, run `tasks.py check` + `board`, commit, push `main` and the masters, protect them.

### 5. Work
Work by the generated `.claude/rules.md` (one project per session, branch per task from the master, tests, no
hardcoding, AR+EN, `Loops: 1/1`, four-role review, PR into the master).

### Report back
The generated parts (folders, prefixes, masters), what was filled vs still TBD, the first ready task of every project
(`python3 scripts/tasks.py next <project>`), and the open decisions the owner must take.

---

<!-- AGENT_PROMPT:START -->
# <system name> — Prompt for the AI agent working in this repository

> Written by SYSTEM_SETUP on <date> for `<repository>` from the owner's answers (raw copy: `docs/BUSINESS_INPUT.md`).
> You are the engineering agent of this monorepo. Everything below is already in `CLAUDE.md`, `BUSINESS_DOMAIN.md` and
> `.claude/*`; this file tells you the order of work. One project per session; sub-agents one at a time; never invent
> an answer the owner has not given — ask.

## 1. Read once
- Root `CLAUDE.md` and `.claude/rules.md` (auto-loaded in every session; never read them again with a tool).
- `BUSINESS_DOMAIN.md` §1–§2, §5.0, §9, §10, §12–§13 — the owner's answers are already there.
- `INTEGRATION.md` §1–§5 once, when a task touches two projects.

## 2. The business
<business summary>

| Fact | Value |
|---|---|
| Default language / RTL | `<default language>` / <rtl> |
| Currency / minor unit | `<currency>` / `<currency minor unit>` |
| Stored / business time zone | `<stored time zone>` / `<business time zone>` |

Actors and permissions:
<actors>

Core business rules (`CLAUDE.md` §4; keep the numbering):
<core business rules>

Entities and states (→ `BUSINESS_DOMAIN.md` §2, §3, §5.6):
<entities and states>

Scheduled jobs and reminders (→ `BUSINESS_DOMAIN.md` §9):
<scheduled jobs>

Integrations (→ `INTEGRATION.md` §3; each behind an SDK port, fake adapter until decided):
<integrations>

Open decisions — ask the owner, never decide them yourself (each is a `PENDING` backlog row):
<open decisions>

## 3. Projects (from `.claude/projects.json`; masters: <masters>)
<projects table>

## 4. Before the first task (once, on a `docs/` branch from `main`, PR into `main`)
1. Walk through every `TBD` in `BUSINESS_DOMAIN.md` and `CLAUDE.md` §1/§4/§6 with the owner; record the answers in the section they belong to with the date. Move the rest to `BUSINESS_DOMAIN.md` §12 as numbered open points.
2. Complete `BUSINESS_DOMAIN.md`: actors table (§1), enums (§2), collections (§3), relationships (§4), testable rules (§5.1–§5.8 refined from §5.0), permissions (§6), real-time events (§7), notifications (§8), jobs (§9), settings keys (§10), error codes (§11 — add codes inside the fenced block, status + client behaviour), integrations (§13).
3. Write a PRD and a BRD per project from `docs/templates/PRD_TEMPLATE.md` / `BRD_TEMPLATE.md` into `<Dir>/docs/` (screens numbered `S01…`, features `F01…`, each naming the `BUSINESS_DOMAIN.md` sections and the API operations it needs). PRD > BRD > Design Script > design files.
4. Write each backlog `<Dir>/docs/<Prefix>_Tasks.md` from `docs/templates/TASKS_TEMPLATE.md` in the format `| ID | Title | Branch | Needs | Status | Notes |`: small tasks (half a day or less), ordered so each builds on merged ones, `Notes` naming the PRD sections, `BUSINESS_DOMAIN.md` sections and operation ids to read. **Server tasks first** (schemas, settings, auth, each aggregate, jobs, contract generation), then admin and app tasks with `Needs` pointing at the server task ids (`BLOCKED` until they are DONE); owner inputs as `PENDING` rows with `**owner input**: …`; a final end-of-backlog row (full gate + end-to-end journey).
5. Rename or delete the `items` sample feature in every part (server module, admin module, app feature, their tests) in favour of the first real aggregate.
6. `python3 scripts/tasks.py check` (OK) and `python3 scripts/tasks.py board`; update `INTEGRATION.md` §1–§6 and root `.claude/session.md`; commit; open the PR into `main`; after the merge push every master from `main` and protect `main` + the masters (PRs only, no force push).

## 5. Then, task by task (every session)
1. `cd <project>`; `python3 scripts/tasks.py next <project>` → the one task (ID, branch, needs, notes). Read only what the row names.
2. `git fetch origin && git branch --no-track <branch> origin/<master> && git checkout <branch>`; `python3 scripts/tasks.py set <ID> "IN PROGRESS"`; task block with acceptance criteria in the project's `.claude/session.md`.
3. Implement + unit tests for every acceptance criterion; no hardcoded values (config, constants, settings); AR + EN strings in resources; server tasks regenerate the API contract and name the affected client tasks.
4. Project gate green; one verification loop (`Loops: 1/1`); four-role review (`Review: PASSED`), fixing every blocking finding first.
5. Commit, push, PR into the project's master (never `main`), merge when green if the owner granted it, `python3 scripts/tasks.py set <ID> DONE` (this unblocks dependents in other projects and rewrites the board), next task. Stop only on `PENDING`/`BLOCKED` rows and report them to the owner.
6. **A feature across modules** goes through the feature line instead of one session per module: agree the decisions with the owner, write `features/my-feature/PACKET.md` (`python3 scripts/line.py new my-feature`, two pages at most), then `python3 scripts/line.py run my-feature` (contract first, then a thin worker per module, QA by script, one reviewer, fix workers) and `python3 scripts/line.py merge my-feature` when the report says every module passed. Read `features/my-feature/REPORT.md`; `python3 scripts/usage.py --feature my-feature` gives the tokens. Details: `.claude/rules.md`, "Feature line".
<!-- AGENT_PROMPT:END -->
