# <Project> — Rules for AI Agents (loaded only inside this folder)

> Root `CLAUDE.md`, `.claude/{rules,roles,hooks,session,memory}.md` and this folder's `.claude/{session,memory}.md` are auto-loaded: never read them with a tool. This file adds the project's conventions; it never relaxes a root rule.

## 1. Stack, commands, gate
- Stack: <runtime, framework, language level, test runner, linter>.
- **Gate (run before every push, read only the summary):** `<one command>` = format check + lint (0 warnings) + typecheck + unit tests + build of every variant + project policies (size limit, hardcode scan, docs freshness, contract drift).
- Unit tests only (batched verification): `<command>`. Contract sync: `<command>` (after the server OpenAPI changes).
- Local run / preview: `<command>`; the sandbox cannot bind ports, so servers run in the Terminal panel.

## 2. Architecture (layers; dependency direction only downward)
- `<layer> → <layer> → …` (e.g. route → middleware → controller → service → repository → schema; or domain → data → infrastructure → design → presentation → app). A lint/depcruise rule enforces it where possible.
- One module per feature; shared code only in named shared folders; file size limit <N> lines (checked by the gate).

## 3. Conventions
- No hardcoded values (root rule §3.3): constants modules, env schema + `.env.example` (a test enforces parity), localization resources (every language), design tokens.
- Errors: typed errors carrying a `code` from `BUSINESS_DOMAIN.md` §11; user-visible messages only in locale files; a new code = catalog entry + both locales (tests enforce).
- Every API change: regenerate and commit the contract / DTOs; name the affected client tasks in the task block.
- Logging without sensitive data; request/trace ids on every error response.

## 4. UI projects (if applicable)
- Run the changed screens in every language, light/dark, phone/tablet/desktop before each commit; measure, do not infer. Console clean.
- Loading/empty/error states for every data-bound element; RTL mirrors icons that imply direction.

## 5. Project-specific gotchas (keep short; durable ones move to `.claude/memory.md`)
