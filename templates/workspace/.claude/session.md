# __SYSTEM_NAME__: repo-level tasks

> Only open repo-level task blocks live here; finished blocks go to `docs/knowledge/session-archive.md`. Each project's task block lives in its own `.claude/session.md`. The map at session start shows the state of every project.

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
