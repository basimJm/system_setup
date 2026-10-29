# Acme Shop — Mandatory Rules (every task)

> Loaded through `CLAUDE.md`. Read once per session; do not re-read with a tool.

## 1. Token efficiency
- Start from `git status`, the files the task touches and the existing implementation; search symbols before opening files and read only the needed ranges; never re-read a file you just wrote.
- Requirements by section: read only the PRD/BRD/design sections the task names (`grep -n "^### "` then a range), never a whole document.
- Keep build output out of the context: run the gate (`scripts/ci/run_local_checks.sh`) and read its summary.
- Keep `.claude/session.md` to the current task + the last 2 blocks and `.claude/memory.md` to durable facts.

## 2. Understand before coding
- State the exact outcome and write acceptance criteria in the task block of `.claude/session.md` before editing.
- Inspect callers, dependencies and tests; list edge cases and regressions; separate requirements from assumptions.
- Ask one concise question only when a missing detail changes correctness and the repo cannot answer it.
- No scope creep: no unrelated refactors or features. Source of truth: PRD > BRD > design script > design files; the backend contract is the API spec (`docs/api/openapi.json`).

## 3. Delivery
1. **Unit tests for every task**: acceptance criteria, edge cases and the regression it fixes; all green. No tests → not done.
2. **One branch per task** from the main development branch (`feat/<id>-<key>`, `fix/…`, `chore/…`); never commit to `main` directly, never force-push, never `--no-verify`.
3. **No hardcoded values**: URLs, hosts, keys, ids, user-visible text, colors, sizes, durations, limits and magic numbers come from config, constants, string resources or design tokens.
4. **One verification loop before push**: re-check every acceptance criterion (coverage, edge cases, errors, security, no hardcoding) and that tests, build and lint are green; record `Loops: 1/1`.
5. **Four-role review before push** (`.claude/roles.md`): list blocking and non-blocking findings, fix the blocking ones, record `Review: PASSED (SE, Mobile, Architect, QA)`.
6. **Run the app before committing UI work**: the changed screens on Android and iOS, Arabic and English, light and dark, phone and tablet/landscape; state what was checked in the commit or PR.
7. Never commit secrets (keystores, `local.properties`, signing files, API keys); Firebase files only in their flavor/environment folders.
8. **Report deviations honestly**: when a rule was not fully applied, say so in the task block and in the final answer; never record `Loops: 1/1` or `Review: PASSED` for a pass that did not happen.

## 4. Task block template (`.claude/session.md`)
```
### <ID> — <title>
- Branch: `<type>/<id>-<key>`
- Status: TODO | IN PROGRESS | BLOCKED | DONE
- Acceptance criteria (PRD §…, API operations …):
  - [ ] ...
- Tests: <files / command / result>
- Loops: 0/1
- Review: PENDING
- Notes: <short; deviations stated plainly>
```
