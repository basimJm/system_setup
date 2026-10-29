# SYSTEM_SETUP

Creates a brand-new multi-project system with the same shape as WAB — backend server, admin web panel, one or more
Kotlin Multiplatform apps, SDK packages — plus the AI-agent workspace that ties them together (root `CLAUDE.md`,
`.claude/{rules,roles,hooks,session,memory}.md`, hooks, `scripts/tasks.py`, `.claude/projects.json`, `INTEGRATION.md`,
per-project backlogs/session/memory files, knowledge playbooks). It also asks about the **business domain** (summary,
language/RTL, currency, time zones, actors, rules, entities/states, jobs, integrations, open decisions) and renders the
answers into the generated `CLAUDE.md`, `BUSINESS_DOMAIN.md`, `docs/BUSINESS_INPUT.md` and `docs/AGENT_PROMPT.md`, so an
agent can write the PRDs and backlogs and work from them. Everything comes from `templates/<kind>/`; the tool itself is the
CLI + template engine. `PROMPT.md` is the prompt to give an AI agent that has to run the tool (§5).

```bash
./SYSTEM_SETUP            # interactive
./SYSTEM_SETUP --help     # flags for non-interactive use
./SYSTEM_SETUP --list-templates
```

Standard-library Python 3.9 only. Tests: `python3 -m unittest discover -s tests`
(they run on `tests/fixtures/templates`, never on the real templates, so the core stays green while templates evolve).

## 1. What it creates

| Part | Template kind | Lands in | Task prefix | Master branch |
|---|---|---|---|---|
| Backend API | `server` | `<PREFIX>-Server/` | `SRV` | `server` |
| Admin web panel | `admin` | `<PREFIX>-Admin-Dashboard/` | `ADM` | `admin` |
| Each KMP app (`Name:slug[:arabic]`) | `kmp` (one copy per app) | `<PREFIX>-Mobile-<Name>/` | 3 letters of the slug (`CUS`), unique | `<slug>` |
| Each SDK (storage, otp, notifications, payments, analytics) | `sdk` (`common/` + `kinds/<name>/` overlay, one copy per SDK) | `<slug>-<name>/` | from the sdk manifest (`STO`, `OTP`, `NOT`, `PAY`, `ANA`) | `server` |
| Workspace root | `workspace` | the target folder | `T` (repo chores) | `main` |

After the parts, the workspace root is instantiated with the engine-computed tokens (`__APPS_TABLE__`,
`__SDKS_TABLE__`, `__PROJECTS_JSON__`, `__MASTERS_LIST__`), `.claude/projects.json` holds one entry per chosen project
(title, prefix, dir, master, backlog, session, memory, integration), and for every project whose template did not
ship them the engine writes `CLAUDE.md`, `docs/<PREFIX>_<Name>_Tasks.md` (first two rows, `tasks.py check` clean),
`.claude/{session,memory,Integration}.md` from `templates/workspace/docs/templates/*_TEMPLATE.md` (built-in starters
when the workspace template has no doc templates). `knowledge/*.md` (lessons, playbooks) is copied to
`docs/knowledge/` and linked from the generated `README.md`. Then `python3 scripts/tasks.py check` runs in the result,
`git init -b main` + first commit, one local branch per master (`server`, `admin`, `<app-slug>`), and the next steps are
printed (push/protect the branches, install + gate + first task per project).

## 2. Questions (Enter keeps the default; `--yes` takes flags and defaults, never prompts)

| Question | Flag | Default / rule |
|---|---|---|
| System name (English) | `--name` | required |
| System name (Arabic) | `--name-ar` | the English name |
| Short prefix for folders and task ids | `--prefix` | first 4 letters upper (`ACME`); 2–6 `[A-Z0-9]`, starts with a letter |
| Package root (Kotlin / Android) | `--package-root` | `com.example.<slug-without-dashes>`; lower dotted, no Kotlin keywords |
| npm scope of the SDKs | `--npm-scope` | `@<slug>` |
| Target folder | `--target` | `./<slug>`; must be absent or empty, never inside this tool |
| Include the backend / admin panel? | `--no-server` / `--no-admin` | yes / yes |
| KMP apps as `Name:slug[:arabic]`, comma separated | `--app` (repeatable) | none; slugs kebab-case, unique, not `main`/`server`/`admin` |
| SDKs from the catalog | `--sdk` (repeatable or comma separated) | none; must exist in the sdk manifest's `kinds` **and** have an overlay folder |
| Dev / prod API base URL, dev / prod web URL | `--dev-api-url` … `--prod-web-url` | `https://api-dev.example.com` … ; **`https://<host>` only, no path** (the apps derive the bare host for xcconfig) |
| Apple Team ID | `--team-id` | skip (empty); 10 `[A-Z0-9]` |
| GitHub owner, repository name | `--github-owner`, `--repo-name` | `owner`, the slug |
| **Business domain** (asked after the values above; multi-line answers end with an empty line, list answers take one item per line or `;`-separated) | `--business FILE` and/or the flags below | `TBD` placeholders (the generated docs list every TBD as an open decision) |
| Business summary (~10 lines: actors, what each app lets them do, how money moves phase 1 vs later) | `--summary` | `TBD` |
| Default language (BCP-47) / right-to-left by default | `--default-language` / `--rtl on\|off` | `ar` / `on` |
| Currency (ISO code) / minor unit and decimals | `--currency` / `--currency-minor-unit` | `TBD` / `TBD` |
| Time zone stored / business time zone computed in (IANA) | `--stored-time-zone` / `--business-time-zone` | `UTC` / `TBD` |
| Actors + permissions · core business rules · entities + states · scheduled jobs · integrations (OTP, payments, push, storage, maps, analytics or `decide later`) · open decisions | `--actors`, `--rules`, `--entities`, `--jobs`, `--integrations`, `--open-decisions` (`;`-separated) | empty = TBD |

Precedence for the business answers: flags > `--business` file > interactive answers/defaults. When a file or a flag is given,
the interactive questions are skipped. The answers are written back as `docs/BUSINESS_INPUT.md` (same headings; pass it to
`--business` to regenerate) and rendered into `CLAUDE.md` §1/§3/§4/§6, `BUSINESS_DOMAIN.md` (§1, §2, §5.0, §9, §10, §12, §13)
and `docs/AGENT_PROMPT.md`.

### Business file format
`.md`: one `## <heading>` section per field (any order, missing sections keep the default; a leading `- ` / `1. ` and
`;` split list items). `.json`: an object with the keys in the second column (strings or arrays).

| Heading | JSON key | Kind |
|---|---|---|
| `## Business summary` | `summary` | multi-line text |
| `## Default language` | `default_language` | text (`ar`) |
| `## RTL` | `rtl` | `on`/`off` (`yes`/`no`, `true`/`false` accepted) |
| `## Currency` | `currency` | text |
| `## Currency minor unit` | `currency_minor_unit` | text (`<unit>, N decimals`) |
| `## Stored time zone` | `stored_time_zone` | text (`UTC`) |
| `## Business time zone` | `business_time_zone` | text (IANA name) |
| `## Actors` | `actors` | list |
| `## Core business rules` | `rules` | list (numbered in the docs) |
| `## Entities and states` | `entities` | list (`Entity: STATE -> STATE`) |
| `## Scheduled jobs` | `jobs` | list |
| `## Integrations` | `integrations` | list |
| `## Open decisions` | `open_decisions` | list |

Other flags: `--templates DIR` (another templates folder, used by the tests), `--knowledge DIR`, `--run-post` (run each
template's `post_generate` commands instead of printing them), `--no-git`, `--list-templates`.

Non-interactive example:
```bash
SYSTEM_SETUP --yes --name "Beta Store" --name-ar "متجر بيتا" --prefix BETA --package-root io.beta --npm-scope @beta \
  --target ~/Projects/beta-store --app Customer:customer --app "Merchant:merchant:التاجر" --sdk storage,otp \
  --dev-api-url https://api-dev.beta.io --prod-api-url https://api.beta.io \
  --dev-web-url https://app-dev.beta.io --prod-web-url https://app.beta.io --team-id ABCDE12345 \
  --github-owner beta-inc --repo-name beta-store --business business.md --rtl off
```

## 3. Token contract (what a template may write)

System-wide, available to every kind: `__SYSTEM_NAME__`, `__SYSTEM_NAME_AR__`, `__SYSTEM_SLUG__`, `__SYSTEM_PREFIX__`,
`__PACKAGE_ROOT__`, `__NPM_SCOPE__`, `__SERVER_DIR__`, `__ADMIN_DIR__`, `__APP_DIR_<n>__`, `__APP_NAME_<n>__`,
`__APP_NAME_AR_<n>__`, `__APP_SLUG_<n>__`, `__APP_PACKAGE_<n>__`, `__APP_PROJECT_<n>__`, `__APP_PREFIX_<n>__` (n = 1-based
app index), `__SDK_DIR_<name>__` / `__SDK_DIR_<NAME>__`, `__SDK_PACKAGE_<NAME>__`, `__SDK_PREFIX_<NAME>__` (every
catalog name, chosen or not, so a package can name a sibling), `__DEV_API_URL__`, `__PROD_API_URL__`, `__DEV_WEB_URL__`,
`__PROD_WEB_URL__`, `__DEV_API_HOST__`, `__PROD_API_HOST__`, `__DEV_WEB_HOST__`, `__PROD_WEB_HOST__`, `__APPLE_TEAM_ID__`,
`__OWNER_GITHUB__`, `__REPO_NAME__`, `__YEAR__`, `__DATE__`, `__APPS_LIST__`, `__SDKS_LIST__`, `__MASTERS_LIST__`
(back-ticked, comma separated).

Workspace only (engine-computed, each on its own line, multi-line values): `__APPS_TABLE__`, `__SDKS_TABLE__`
(rows `| \`dir/\` | description | status |`), `__PROJECTS_JSON__` (the `projects` object of `projects.json`, indented
for `"projects": __PROJECTS_JSON__`).

Business domain (from the answers, available to every kind; the workspace template uses them): `__BUSINESS_SUMMARY__`
(multi-line, own line), `__DEFAULT_LANGUAGE__`, `__RTL__` (`on`/`off`), `__CURRENCY__`, `__CURRENCY_MINOR_UNIT__`,
`__STORED_TIME_ZONE__`, `__BUSINESS_TIME_ZONE__`, and the lists rendered as markdown on their own line:
`__BUSINESS_ACTORS__`, `__BUSINESS_ENTITIES__`, `__BUSINESS_JOBS__`, `__BUSINESS_INTEGRATIONS__` (bullets),
`__BUSINESS_RULES__` (numbered), `__OPEN_DECISIONS__` (the owner's open decisions + every answer left `TBD`, flagged
`open — ask the owner`). An empty list renders as one `TBD (open — ask the owner)` item.

Per app, while the `kmp` template is instantiated for that app: `__APP_NAME__`, `__APP_NAME_AR__`, `__APP_SLUG__`,
`__APP_DIR__`, `__APP_PACKAGE__` (`<package root>.<slug>`), `__APP_PACKAGE_PATH__` (`com/acme/customer`),
`__APP_PACKAGE_DASHED__` (`com-acme-customer`), `__APP_PROJECT__` (PascalCase name), `__APP_PREFIX__`, `__APP_MASTER__`,
`__API_PREFIX__` (`/<slug>/v1`), `__REALTIME_NAMESPACE__` (`/<slug>`).

Per SDK, while the `sdk` template is instantiated for that SDK: `__SDK_NAME__` = `__SDK_KIND__`, `__SDK_TITLE__` =
`__SDK_KIND_TITLE__`, `__SDK_DIR__`, `__SDK_PACKAGE__` (`<scope>/<name>`), `__SDK_PREFIX__`, `__SDK_DESCRIPTION__`,
`__SDK_LAYER__` (the overlay folder).

Repeated blocks (any text file): lines between `__EACH_APP__` … `__END_EACH__` (or `__EACH_SDK__`) are repeated once per
app/SDK with the per-app/per-SDK tokens filled in; the block disappears when there is none.

## 4. `templates/<kind>/TEMPLATE.json`

```json
{"kind": "server", "description": "…",
 "placeholders": ["__SYSTEM_NAME__", "__APP_DIR_<n>__"],
 "sentinels": {"Acme Shop": "__APP_NAME__"},          "rename_paths": {"com/acme/shop": "__APP_PACKAGE_PATH__"},
 "skip": ["node_modules/**", "**/build/**"],           "post_generate": ["npm ci", "npm run verify"],
 "binary_globs": ["**/*.png"],
 "layers": ["common", "kinds/__SDK_NAME__"],          "dest": "__SERVER_DIR__",
 "kinds": {"storage": {"prefix": "STO", "title": "Storage", "dir": "kinds/storage", "description": "…"}},
 "targeted": [{"file": "…/RealtimeConfig.kt", "placeholder": "__REALTIME_NAMESPACE__",
               "find": "APP_NAMESPACE = \"/app\"", "replace_with": "APP_NAMESPACE = \"__REALTIME_NAMESPACE__\""}]}
```

- `kind` must equal the folder name; `placeholders` lists the tokens the files use (documentation + the "unresolved"
  report); unknown keys (`_comment`, `placeholder_notes`, `derived_placeholders`, `sentinel_locations`,
  `neutral_literals`, `verified`, …) are ignored.
- **Sentinels**: literal strings in the template that stand for a token (the kmp snapshot's identity `Acme Shop` /
  `com.acme.shop` / `com-acme-shop` / `com/acme/shop` / `AcmeShop`, the `example.com` URLs and bare hosts, `TEAMID0000`,
  `/app/v1`, `WAB-Server`). Replaced longest literal first, plain string replacement, then tokens become values.
  The engine never substitutes inside `binary_globs`, files that are not UTF-8, or (workspace) `.claude/skills/**`.
- **rename_paths**: the same idea on the relative path of every file (`com/acme/shop` → the package as a path spans
  folders; `AcmeShop` → the project name); tokens in paths are rendered too (`WAB___APP_PROJECT___Tasks.md`); parents
  are created; execute bits are preserved.
- **layers**: sub-folders copied in order, later ones overlay earlier ones. Defaults: `sdk` = `common/` then the kind's
  overlay (`kinds.<name>.dir`, else `kinds/<name>/`); `kmp` = `project/` when present; otherwise the template root.
- **dest** (optional): where the part lands relative to the repo root; defaults per kind (`__SERVER_DIR__`,
  `__ADMIN_DIR__`, `__SDK_DIR__`, `__APP_DIR__`, `.` for workspace).
- **kinds** (sdk only): the SDK catalog the template ships; `prefix` and `title` fill `__SDK_PREFIX__` / `__SDK_TITLE__`,
  `dir` names the overlay folder, `description` fills `__SDK_DESCRIPTION__`. A chosen SDK without an overlay folder is
  refused before anything is written.
- **targeted**: exact `find` → `replace_with` edits applied to one generated file after substitution, for values too
  short to replace globally; a missing file or text is an error.
- **post_generate**: commands (tokens rendered) printed at the end, or run inside the part with `--run-post`.
- Verification: after every part the engine lists the declared tokens left unfilled (`unresolved`), other `__X__`
  strings (the template's own code, informational), and sentinel literals still present in a path or text file
  (`sentinel_left`). For the `kmp` kind a sentinel left anywhere aborts the run (same rule as the snapshot's
  `instantiate.py`); literals that equal one of the answers (the user kept `example.com`) are not leftovers.

## 5. `PROMPT.md` — the prompt for an AI agent

`PROMPT.md` at the tool root has two parts. **Part A** is the generic prompt to give an agent that must create a new
system with this tool: how to find and test the tool, which answers to collect from the owner (with the `<…>`
placeholders to fill), the `--yes` command line, the checks to run in the result, then "configure the domain" and
"work by the rules". **Part B** (between `<!-- AGENT_PROMPT:START -->` / `<!-- AGENT_PROMPT:END -->`) is written by the
engine into every generated repository as `docs/AGENT_PROMPT.md` with the business answers, the project table and the
masters filled in (`business.prompt_placeholders`); the generated `README.md` links it as "give this to your AI agent".
It tells the agent working in the new repository to read root `CLAUDE.md` + rules once, fill the TBDs of
`BUSINESS_DOMAIN.md` with the owner, write the PRD/BRD per project from `docs/templates/`, write every backlog
`<Dir>/docs/<Prefix>_Tasks.md` (`| ID | Title | Branch | Needs | Status | Notes |`, server tasks first, clients `BLOCKED`
on server ids), run `tasks.py check`/`board`, then follow the per-task loop (`tasks.py next`, branch from the master,
tests, no hardcoding, AR+EN, `Loops: 1/1`, four-role review, `tasks.py set`, PR into the master). Placeholders in Part B
that name an answer use the field headings in lower case (`<business summary>`, `<currency>`, …) plus `<system name>`,
`<repository>`, `<date>`, `<masters>`, `<projects table>`; `tests/test_business.py` fails when Part B uses one the filler
does not know.

## 6. Adding a template kind

1. Add the kind to `KINDS` and `DEFAULT_DEST` in `src/system_setup/manifest.py` (and `DEFAULT_LAYERS` / `DEFAULT_VERBATIM`
   when it needs an overlay or verbatim folders); extend `needed_kinds()` and the instantiation order in
   `src/system_setup/cli.py`; add its registry entry/prefix rule in `src/system_setup/workspace.py` + `prompts.py` when it is
   a project of its own (new master, task prefix, backlog name).
2. Put a fixture under `tests/fixtures/templates/<kind>/` (a few files exercising sentinels, renames, skip, a binary)
   and extend `tests/test_e2e.py`; keep `python3 -m unittest discover -s tests` green.
3. Document the new tokens here and in the template's `TEMPLATE.json` `placeholders`.

## 7. Layout

```
SYSTEM_SETUP                 entry (bash → python3 src/system_setup/cli.py)
src/system_setup/cli.py      questions, flags, generate(), report
src/system_setup/prompts.py  validators, derived names, Spec (every token value)
src/system_setup/business.py business-domain questions, --business file parsing, business tokens, BUSINESS_INPUT.md, AGENT_PROMPT.md
PROMPT.md                    Part A: prompt for an agent that sets up a system; Part B: filled into every repo as docs/AGENT_PROMPT.md
src/system_setup/manifest.py TEMPLATE.json contract
src/system_setup/engine.py   copy, substitute, rename, layers, targeted edits, verification, post_generate
src/system_setup/kmp.py      kmp snapshot identity check + fail-loud verification per app
src/system_setup/workspace.py projects.json, per-project files, knowledge, tasks.py check, git init + masters, next steps
templates/<kind>/            built by the template owners (workspace, server, admin, sdk, kmp)
knowledge/                   LESSONS.md, PLAYBOOKS.md (copied into every generated workspace)
tests/                       unit + end-to-end tests on tests/fixtures/templates (+ tests/fixtures/knowledge)
```
