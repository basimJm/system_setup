# __SYSTEM_NAME__ — Hooks & Task Workflow

Two layers work together:
1. **Automated hooks** (`.claude/settings.json` → `.claude/hooks/*.py`) run by Claude Code and enforce the hard rules.
2. **The review hook** (this file, §2) — the four-role code review Claude performs after every task. The Stop hook blocks the end of a task until it is recorded.

## 1. Automated Hooks
| Event | Script | What it does |
|---|---|---|
| `SessionStart` | `session_start.py` | Prints branch, the live map (`scripts/map.py`, with the module of the working folder) and open tasks from every session file. |
| `UserPromptSubmit` | `prompt_reminder.py` | Adds a one-line reminder of the rules to every request. |
| `PreToolUse` (Bash) | `guard_git.py` | **Blocks** commits on `main`/`master`, any push to `main`/`master`, force pushes, `--no-verify`, and pushing a branch whose task block (in any session file) lacks `Loops: 1/1` and `Review: PASSED`. Resolves the checkout from the command's `cwd` (worktrees). |
| `PostToolUse` (Edit/Write) | `check_hardcoded.py` | **Flags** hardcoded secrets, URLs, IPs and ports in source files; move them to config/constants. |
| `Stop` | `stop_review.py` | **Blocks** finishing while source code changed on the branch and either no test files changed or the task block is missing `Loops: 1/1` / `Review: PASSED`. Master branches (from `projects.json`) are exempt: they only hold merged PRs. |

Every check above is a rule with an id (`.claude/rules.md`). The hooks read the `rules` map of `.claude/projects.json`: a rule the system plan turned off is not enforced, and a missing entry means on.

`Loops: 3/3` in old blocks stays valid; new blocks write `Loops: 1/1`. Hook tests: `python3 .claude/hooks/test_hooks.py`. The sandbox cannot write `.claude/hooks/`: patch hooks through the Terminal panel and ship the patch by PR into `main`.

Line workers (`scripts/line.py`) run with only `guard_git.py` and `check_hardcoded.py`; the script replaces the rest (`rules.md`, "Feature line").

## 2. Review Hook — run after every task, before push
Review the full branch diff (`git diff origin/<master>...HEAD` plus uncommitted changes) once per role from `.claude/roles.md`. List findings as **Blocking** or **Non-blocking**. Fix all blocking findings, re-run tests, then repeat the review for the changed parts.

Checklist (every item "yes" or justified):
- **Software Engineer:** correct; minimal scope; Clean Architecture layers; strong typing; errors handled; no duplication; no hardcoded values; no secrets; efficient queries/indexes; logs without sensitive data.
- **Mobile Engineer:** (if mobile or an API for mobile is touched) RTL+LTR, all languages in resources, light/dark, loading/empty/error states, accessibility, lifecycle/permissions, matches PRD screen + design.
- **Solution Architect:** API namespace/scope correct; contract regenerated and committed (server API docs; clients re-synced) and affected tasks named; integrations via SDK ports; business rules from `CLAUDE.md` §4 respected; config-driven; next phases not blocked.
- **QA Engineer:** acceptance criteria listed; each has a unit test; edge cases covered; all tests/build/lint green; no regression in callers; browser/simulator check done for UI.

Record in the task block of the **project's** `.claude/session.md`:
```
- Review: PASSED (SE ✔, Mobile ✔/N/A, Architect ✔, QA ✔) — <one-line summary>
```

## 3. Task Workflow (every task)
1. `python3 scripts/tasks.py next <project>` → the task row (ID, branch, needs, notes). Read only the PRD sections and operations it names.
2. `git fetch origin && git branch --no-track <branch> origin/<master> && git checkout <branch>`; `python3 scripts/tasks.py set <ID> "IN PROGRESS"`.
3. Add the task block to the project's `.claude/session.md` (template below) with acceptance criteria; keep only the current + last 2 blocks there.
4. Implement + unit tests. Run the project's gate.
5. One verification loop → `Loops: 1/1`.
6. Four-role review (§2) → `Review: PASSED`.
7. Commit (including the backlog/board changes), push, open the PR into the master, merge when the gate is green (rules §3.10), `tasks.py set <ID> DONE` (it copies a real `Lesson:` line to `docs/knowledge/LESSONS.local.md`), commit the status change on the master through the PR flow of the next task or a `docs/` branch.
8. Durable facts → the project's `.claude/memory.md` (short); cross-project facts → root `memory.md`; one-line update of the project's row in root `session.md`.

### Task block template (project `.claude/session.md`)
```
### <ID> — <title>
- Branch: `<type>/<prefix>-NNN-<key>`
- Status: TODO | IN PROGRESS | BLOCKED | DONE
- Acceptance criteria (PRD §…, BUSINESS_DOMAIN §…, operations …):
  - [ ] ...
- Tests: <files / command / result>
- Loops: 0/1
- Review: PENDING
- Notes: <short; deviations from the rules stated plainly>
- Lesson: <one line or none>
```
`Lesson:` is one line that would help the next system (a pitfall, a fix, a check), written without names, URLs or secrets; `none` when the task taught nothing new. `SYSTEM_SETUP lessons import` reviews the collected ones.
The `Branch:` line must hold exactly the branch name (optionally in backticks) and nothing else: the hooks match it literally.
