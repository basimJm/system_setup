# __SYSTEM_NAME__: start here

Session start prints the live system map (`scripts/map.py`). **Do not read files to get the picture.** Use the map, then `python3 scripts/recall.py <words>` for a detail, then read only the lines it names. `python3 scripts/map.py <project>` shows one module.

**__SYSTEM_NAME__:** the business, its rules and the open decisions are in `docs/knowledge/system-overview.md`. Replace this line with one paragraph once the first PRD exists.

## Hard rules
1. Task branch from the project's master (`git branch --no-track <name> origin/<master>`). Never commit or push to `main` or a master; never force-push; never `--no-verify`; never disable hooks (line workers: `.claude/rules.md`, "Feature line").
2. Unit tests with every code change. No hardcoded values. No secrets. Never edit or source `.env*`.
3. Data and rules: `BUSINESS_DOMAIN.md`. Behaviour: PRD > BRD > Design Script > design files. Wire format: the server's `docs/api/openapi.*.json`. A conflict or an open business rule: ask, never guess.
4. Say plainly when a rule was not applied. Never write `Loops: 1/1` or `Review: PASSED` for a check that did not happen.
5. **One project and one task per session; `/clear` after each merge.** Long sessions are the biggest cost: every request resends the whole context.

## Task flow
`python3 scripts/tasks.py next <project>` → branch → `tasks.py set <ID> "IN PROGRESS"` → task block in the project's `.claude/session.md` → implement + tests → project gate → one verification loop → four-role review → PR into the master → merge → `tasks.py set <ID> DONE`.

A feature across modules: `python3 scripts/line.py new <name>`, fill the packet with the owner, `line.py run <name>`, `line.py merge <name>`. QA alone: `scripts/qa.py <project>`. Token numbers: `scripts/usage.py`.

## Read on demand, once, only when needed
- Delivery rules: `.claude/rules.md`. Review checklist and task block template: `.claude/hooks.md`. Roles: `.claude/roles.md`.
- System overview: `docs/knowledge/system-overview.md`. Integration: `INTEGRATION.md`.
- Lessons that match this system's modules: `docs/knowledge/LESSONS.md`. Older task blocks and facts: `docs/knowledge/`, `<project>/docs/knowledge/` (search them with `recall.py`).

@.claude/memory.md
