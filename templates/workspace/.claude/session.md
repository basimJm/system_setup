# __SYSTEM_NAME__ — Session Index (all projects at a glance)

> One line per project. The working task block of a project lives in **its own** `.claude/session.md` (loaded only in that folder). This index is for an agent that needs the whole picture; update a project's line when its current task changes. Live counts: `python3 scripts/tasks.py board`; next task: `python3 scripts/tasks.py next <project>`. Created __DATE__.

| Project (`tasks.py` key) | Master | Current task | Next ready task | Blocked on | Session file |
|---|---|---|---|---|---|
<!-- one row per entry of .claude/projects.json, e.g.: | server | `server` | none | SRV-001 scaffold | — | `__SERVER_DIR__/.claude/session.md` | -->

## Repo-level tasks (this branch)

> Workspace chores (syncs, hook patches, tooling) get a block here with the `__SYSTEM_PREFIX__-NNN` prefix; they follow the same template and the same `Loops`/`Review` lines as project tasks. Keep the current + last 2 blocks only.

### __SYSTEM_PREFIX__-001 — Workspace created from the SYSTEM_SETUP template
- Branch: `chore/workspace-setup`
- Status: DONE
- Acceptance criteria:
  - [x] `python3 scripts/tasks.py check` OK for every project in `.claude/projects.json`
  - [x] `python3 .claude/hooks/test_hooks.py` and `python3 -m unittest scripts/test_tasks.py` green
  - [x] every project has `docs/<Name>_Tasks.md`, `.claude/{session,memory,Integration}.md` and a `CLAUDE.md`
- Tests: the three commands above
- Loops: 1/1
- Review: PASSED (SE ✔, Mobile N/A, Architect ✔, QA ✔) — docs + tooling only; no product code.
