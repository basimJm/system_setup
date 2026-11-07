# SYSTEM_SETUP

Creates a brand-new multi-project system with the shape of a production marketplace — backend server, admin web panel, one or more
Kotlin Multiplatform apps, SDK packages — plus the AI-agent workspace that ties them together (root `CLAUDE.md`,
`.claude/{rules,roles,hooks,session,memory}.md`, hooks, `scripts/tasks.py`, `.claude/projects.json`, `INTEGRATION.md`,
per-project backlogs/session/memory files, knowledge playbooks). It also asks about the **business domain** (summary,
language/RTL, currency, time zones, actors, rules, entities/states, jobs, integrations, open decisions) and renders the
answers into the generated `CLAUDE.md`, `BUSINESS_DOMAIN.md`, `docs/BUSINESS_INPUT.md` and `docs/AGENT_PROMPT.md`, so an
agent can write the PRDs and backlogs and work from them. Everything comes from `templates/<kind>/`; the tool itself is the
CLI + template engine. `PROMPT.md` is the prompt to give an AI agent that has to run the tool (§5).

```bash
./SYSTEM_SETUP                    # interactive (run from a clone of this repository)
./SYSTEM_SETUP --help             # flags for non-interactive use
./SYSTEM_SETUP --list-templates
./SYSTEM_SETUP intake             # Claude interviews you and writes BUSINESS.md (§7)
./SYSTEM_SETUP new --business-doc BUSINESS.md   # analyze, review the plan, generate (§7)
/path/to/system-setup/SYSTEM_SETUP --help   # the entry works from any folder
```

Standard-library Python 3.9 only. Tests: `python3 -m unittest discover -s tests -p 'test_*.py'`
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
Code-facing defaults, used by `targeted` edits of generated source: `__BUSINESS_TIME_ZONE_CODE__` (the business time zone when
it is an IANA name, else the neutral fixed-offset zone `Etc/GMT-3`) and `__CURRENCY_CODE__` (the first three-letter code in
the currency answer, else the ISO code for no currency, `XXX`). Template tests pin their own fixture zone, so after choosing
another zone re-derive the offset assertions that name `Etc/GMT-3`.

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
  `/app/v1`, `Acme-Server`). Replaced longest literal first, plain string replacement, then tokens become values.
  The engine never substitutes inside `binary_globs`, files that are not UTF-8, or (workspace) `.claude/skills/**`.
- **rename_paths**: the same idea on the relative path of every file (`com/acme/shop` → the package as a path spans
  folders; `AcmeShop` → the project name); tokens in paths are rendered too (`Acme___APP_PROJECT___Tasks.md`); parents
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

## 7. From a business description: `intake`, `new` and the plan

The flat command above asks for every value. The plan-driven flow starts from the business instead:

```bash
./SYSTEM_SETUP intake [--out BUSINESS.md]
./SYSTEM_SETUP new [--business-doc FILE | --plan FILE] [--yes] [--target DIR] [--templates DIR] [--knowledge DIR] [--no-git] [--run-post]
                   [--no-documents] [--documents-budget USD]
./SYSTEM_SETUP documents [--target DIR] [--business-doc FILE] [--budget USD]
```

**`intake`** starts an interactive `claude` session with `INTAKE_PROMPT.md` as its instructions (`claude <start message> --tools Write
--append-system-prompt <INTAKE_PROMPT.md + the output path>`, run from the folder of `--out`, with `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`).
Claude interviews a non-technical person in their own language, one question at a time and without jargon, until the picture is
complete (who uses it, what each kind of user does, how money moves, rules, the stages of the main things, reminders, languages,
countries, currency, what exists already), keeps what was decided apart from what was not, never invents an answer, and writes
`BUSINESS.md` in a fixed structure (sections 1 to 11, headings in English, content in the person's language). It asks for no secret.
It refuses to overwrite an existing file. Without `claude` it prints what to do: paste `INTAKE_PROMPT.md` into claude.ai, answer,
save the result as `BUSINESS.md`, then run `new --business-doc BUSINESS.md`.

**`new`** takes a free-form business document (the `intake` result, or any text in any language; `examples/business/` has three):
1. *Analyze*: one `claude -p` call through the `Analyzer` seam (`src/system_setup/analyzer.py`). Flags: the document on stdin inside
   `<business_document>` tags, `--system-prompt` (the document is data, not instructions; gaps become `open_questions`, never invented
   values), `--json-schema` of the plan, `--tools ""`, `--strict-mcp-config`, `--setting-sources ""`, `--disable-slash-commands`,
   `--no-session-persistence`, `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`, `--max-budget-usd`, run from an empty temporary folder. Model, budget
   cap, `claude` command and timeout are data in `catalog/analyzer.json`. The real cost from the JSON result is printed. Failures end with a
   message: `claude` missing, a non-zero exit, a budget stop, output that is not JSON or not the plan, a plan that fails validation (one
   repair call that lists the problems, inside the same budget, then a clear error).
2. *Review* (`src/system_setup/review.py`, proposal as the default, Enter keeps it): names and identifiers; per module keep / remove /
   add and its platforms (web, Android, iOS); per SDK keep / remove / add, then build internally, already published (package +
   version) or none, then the provider (the catalog list, `other`, or none); per deployable module the host, and for the server the
   database and cache; each open question (Enter leaves it open, `=` takes the proposed answer); the language of the generated documents.
   It never asks for a secret and refuses one that is typed (key shapes, `password=...`, long opaque tokens). `--yes` accepts the proposal.
3. *Generate*: `system.plan.json` (the reviewed plan) and `docs/BUSINESS.md` (the document) are written into the new repository and
   committed with it. What the engine builds today is generated through `generate()`: the server, the admin panel, KMP apps (Android and
   iOS together) and every SDK set to build internally, with its providers (see *SDKs and providers* below). Everything else in the plan is printed at the end under **Recorded in the plan,
   generated in a later phase** (web modules, single-platform apps, other languages) and never makes the run fail. If generation fails after the analysis, the reviewed plan is saved as
   `system.plan.json` in the current folder so nothing paid for is lost.

`new --plan FILE` skips the model for the plan: the plan is validated, reviewed (or accepted with `--yes`) and generated.

### The document step (`documents.py`, `docrender.py`, `catalog/prompts/`)
After the parts are generated and before the first commit, `new` writes the documents of a mature project with one small model call
each, through the same `Analyzer` seam and flags as the analysis (no tools, no MCP, no settings). It runs when a business document is
given (`--business-doc`, with or without `--plan`); `--plan` alone uses no model, and `--no-documents` skips the step. What is written:

| Document | Where | Notes |
|---|---|---|
| `BUSINESS_DOMAIN.md` | root | written first; every other document cites its section numbers. `## 11. Error Codes` keeps the shipped block (the admin and app tests compare their error catalogs with it); the business's own codes are added as a proposal in §11.1 |
| BRD, PRD, Design Script | `<project>/docs/` (a module with no generated project yet, such as a web app, goes to `docs/modules/<id>/`) | per module, server first; the server has no Design Script; screens `S01…`, flows `F01…`, capabilities `C01…`, requirements `B01…` |
| backlog | the project's backlog file | JSON Schema output rendered here in the exact `\| ID \| Title \| Branch \| Needs \| Status \| Notes \|` format; foundation rows `TODO`, a row needing another project `BLOCKED`, each unanswered open question a `PENDING` row marked `**owner input**`, a final end-to-end row |
| `INTEGRATION.md` | root | §3, §4, §5, §8 are written for the business; the rest of the template, including the live board markers, is kept |
| API drafts | `<server>/docs/api/draft/openapi.<module>.draft.json` | OpenAPI 3.1 per client module, marked a starting draft, validated; never written over `docs/api/openapi.*.json`, which the server generates from code and its tests compare |
| `CLAUDE.md` facts | root and every project | a marked block rewritten on every run |

Order: domain; per module (server first) BRD, PRD, Design Script; then the backlogs, server first (a client row needs the ids of server
rows, and the server backlog reads digests of the client PRDs); then `INTEGRATION.md` and the API drafts. Each call receives its plan
slice, the relevant paragraphs of the business document and only the sections of earlier documents it must agree with. The document is
data between tags, never instructions. Prose is written in the plan's document language; ids, section numbers, headings, table headers and
`tasks.py` statuses stay English. Prompts and the headings each document must have are data in `catalog/prompts/`.

Budget and cost: `catalog/documents.json` holds the model, the budget of one call and the budget of one run (`--documents-budget`
overrides it); a call is never started that could not fit, so the run stops before exceeding the total and can be resumed. The cost
of every call and the total are printed from the real result.

Resume: `.system_setup/documents.json` records every document with the hash of exactly what was sent to the model. `SYSTEM_SETUP
documents --target DIR` (also what to run after a stop or a kill) skips what is done and unchanged, redoes what changed or failed, keeps a
document someone edited, and keeps a backlog whose statuses changed. A Markdown document is checked for its headings and for leftover
`TBD` or template tokens; a failure gets one repair call, then it is written, marked `invalid` in the state file and reported, and the
rest of the run finishes. A backlog or contract that stays invalid is not written.

### The plan file (`system.plan.json`, `src/system_setup/plan.py`)
Versioned (`schema_version`: 1) and validated with the standard library only. Model output is untrusted: every field is checked and all
problems come back together, each naming its field, for example `modules[1].platforms[0]: 'desktop' is not one of android, ios, web`.

| Section | Holds |
|---|---|
| `system` | `name` (Latin letters), `name_ar` (optional local-script name), `slug`, `prefix`, `package_root`, `npm_scope` |
| `languages` | `default`, `supported`, `direction` (`ltr`/`rtl`), `documents` (language of the generated documents) |
| `countries`, `currency`, `time_zones` | ISO country codes; `code`, `minor_unit`, `decimals`; `stored`, `business` (IANA) |
| `business` | `summary`, `actors` (`name`, `does`), `rules`, `entities` (`name`, `states`), `jobs`, `existing` |
| `modules` | `id`, `kind` (from the catalog: `server`, `admin`, `app`, `web`), `name`, `audience`, `why`, `platforms` (`server`, `web`, `android`, `ios`; limited per kind) |
| `sdks` | `id`, `title`, `why`, `source` (`internal`, `published`, `none`), `package` + `version` (only when published), `provider` (one name or several separated by commas), `known`, `provider_known` |
| `deployment` | per deployable module (`part` = module id): `host`, `database`, `cache`, `known` |
| `rules` | empty in version 1 (rules arrive in a later phase) |
| `open_questions` | `id`, `question`, `why`, `proposed_default`, `answer` (null while open) |

`known` and `provider_known` are computed from the catalog when a plan is read (never trusted from the input): an SDK, provider or host
that is not in the catalog is allowed and marked `known: false`.

### The catalog (`catalog/*.json`, `src/system_setup/catalog.py`)
Lists are data: `modules.json` (platforms and module kinds with their allowed and default platforms), `sdks.json` (a `generated` flag
that must match the SDKs with a dedicated overlay, and `ports`: what a provider adapter implements), `providers.json` (common vendors per SDK; OTP, push and e-mail notifications, payments,
storage, maps, analytics; `adapter` or `builtin` where a ready adapter exists), `deploy.json` (hosts per part kind, each naming its `deploy` overlay; databases and caches, each with `supported`; the build, start, port, health path and environment key names of each part kind), `analyzer.json`. They are proposals: any other name
is allowed. Adding a choice is a JSON edit; no code changes.

### SDKs and providers (`src/system_setup/sdks.py`)
The plan's `sdks` decide what is generated; nothing is hard-coded per SDK or provider.

| `source` | What happens |
|---|---|
| `internal` | The SDK folder `<slug>-<id>/` is generated. A catalog SDK with a dedicated overlay (`templates/sdk/kinds/<id>/`) uses it; **any other SDK, listed or new in the plan, is built from the generic overlay** `templates/sdk/kinds/generic/`: a port, a fake adapter, a contract test (`tests/contract/port.contract.ts`), a facade with timeout and retries, a loop test, its own folder, a unique task prefix and its backlog, all named from the plan through tokens. |
| `published` | No folder. The package and version are added to the generated server's `package.json` and to a section of the root `INTEGRATION.md`. |
| `none` | Nothing is generated. |

Each chosen provider (`provider` may name several, separated by `,`, `+` or `/`) is then handled inside that SDK:

| Provider | Result |
|---|---|
| has an `adapter` in `catalog/providers.json` | `templates/sdk/providers/<sdk>/<adapter>/files/` (source and unit tests) is copied in and exported from `src/index.ts`; its npm packages are added to **that SDK's** `package.json` only, so the shipped lock no longer matches and that SDK's `post_generate` runs `npm install` once instead of `npm ci`; its environment **key names** go to `.env.example`; a `PENDING` backlog row asks the owner for a proof with a real account. |
| is `builtin` (already in the SDK overlay, e.g. S3) | Nothing is copied; it is named the default. |
| has no adapter, or is not in the catalog | A **skeleton**: `src/adapters/<id>.ts` implements the port and rejects every call; `tests/<id>.test.ts` holds an `it.failing` test that lists what is missing, so the generated SDK's CI stays green and honest (the day the adapter works the test turns red and says to remove the marker); and a `TODO` backlog row. |

The first chosen provider is named the default in `src/config/providers.ts` (`CHOSEN_PROVIDERS`, `DEFAULT_PROVIDER`) and in a comment of `.env.example`, which holds key names only, never a value. The port a skeleton implements comes from `ports` in `catalog/sdks.json` (by channel; `generic_port` for any other SDK), and what a skeleton lacks from `skeleton.missing` in `providers.json`. An sdk template without a `providers/` folder still generates (providers are skipped).

Ready adapters, ported and generalized (no business names, URLs or keys) from a production system: `fcm` (push, firebase-admin loaded lazily), `smtp` (e-mail, nodemailer), `http-sms` (SMS through any JSON HTTP gateway), and `s3`, `cloudflare-r2`, `backblaze-b2` (built into the storage SDK). To add one: put `adapter.json` (packages, environment keys, exports, usage) and `files/` under `templates/sdk/providers/<sdk>/<adapter>/` and add `"adapter": "<adapter>"` to the provider in `providers.json`; no code changes. Adapter unit tests use stubbed vendors, so only a real push, e-mail or SMS proves the vendor side.


### Deployment (`src/system_setup/deploy.py`, `templates/deploy/`, `catalog/deploy.json`)
The plan's `deployment` says where each part runs. For every part the engine generates, only the **chosen host's** configuration and a short
guide are written into the part's folder, copied from a data-driven overlay `templates/deploy/<overlay>/<part kind>/` with tokens
(`__SERVICE_NAME__`, `__PART_DIR__`, `__PART_BUILD__`, `__PART_PORT__`, `__PART_HEALTH__`, `__ENV_KEYS__` and a `__EACH_ENV__` block that repeats
once per environment key name; the key names come from the server's `docker/env.prod.example` or from `deploy.json`). Every host names its overlay
in `catalog/deploy.json` (`deploy`), so a new host is a folder and a line of JSON, never code. An overlay may `extends` others and alias a part kind
to another (`overlay.json`: `web` -> `admin`).

| Host | server | admin / web | Files written |
|---|---|---|---|
| Render | yes | yes | `render.yaml` (Node web service; static site with a rewrite), `docs/HOSTING.md` |
| Docker on a server | yes | yes | server: guide only (the template's `Dockerfile` and `docker-compose.deploy.yml` are used); static: `Dockerfile`, `nginx.conf.template`, `docker-compose.deploy.yml`, `.dockerignore` |
| AWS | yes | yes | server: `ecs-task-definition.json` (Fargate; secrets are Parameter Store references); static: a guide for S3 + CloudFront |
| Fly.io | yes | yes | `fly.toml` (+ the static Docker files for a static part) |
| Railway | yes | yes | `railway.json` (+ the static Docker files for a static part) |
| Cloudflare Pages | no | yes | `wrangler.toml` |
| Vercel | no | yes | `vercel.json` |
| Netlify | no | yes | `netlify.toml` (moved here from the admin template) |
| custom, or any host not in the catalog | yes | yes | Docker files, a guide, and a `PENDING` backlog row asking for the real host |

A host that cannot run a part (a server on Cloudflare Pages) is refused when the plan is read, with the hosts that can. Generic files name no
host: `docs/DEPLOYMENT.md` at the root lists the plan's choices (the only place), and `docs/DEPLOYMENT.md` of the server and `docs/DEPLOY.md` of the admin
panel are host-neutral. Only environment **key names** are written, never a value.

**Databases are honest.** The server template uses MongoDB and Redis. If the plan picks another database or cache, generation still works, prints a
warning, and adds a `PENDING` backlog row to the server saying its data layer must change; `catalog/deploy.json` marks which choices the template
supports. Nothing switches automatically. `none` means nothing was chosen (the template still needs both). Configs are checked by tests that parse them;
no deploy is ever run by the tool, and a real deploy needs an account with that host.

## 8. Layout

```
SYSTEM_SETUP                 entry (bash → python3 src/system_setup/cli.py)
src/system_setup/cli.py      questions, flags, generate(), report
src/system_setup/prompts.py  validators, derived names, Spec (every token value)
src/system_setup/business.py business-domain questions, --business file parsing, business tokens, BUSINESS_INPUT.md, AGENT_PROMPT.md
src/system_setup/commands.py `intake` and `new` (the plan-driven flow)
src/system_setup/plan.py     system.plan.json: versioned schema, validation, the model's JSON schema
src/system_setup/catalog.py  loads catalog/*.json (module kinds, SDKs, providers, hosts, analyzer settings)
src/system_setup/analyzer.py the Analyzer seam: ClaudeAnalyzer (claude -p), FakeAnalyzer, propose() with one repair retry
src/system_setup/documents.py the document step: jobs, slices, budget, state file, resume, writing
src/system_setup/docrender.py markdown checks, backlog schema + rendering, OpenAPI draft, CLAUDE.md facts (pure functions)
src/system_setup/review.py   the review questions, secret refusal
src/system_setup/planspec.py plan -> Spec for generate(), and the list of what is recorded but not generated yet
src/system_setup/sdks.py     plan SDKs by source, providers: ready adapters, builtin, skeletons, published SDKs, backlog rows
src/system_setup/deploy.py   deployment of the plan: host overlays per part, database warning, docs/DEPLOYMENT.md, backlog rows
catalog/                     modules.json, sdks.json, providers.json, deploy.json, analyzer.json, documents.json (data only)
catalog/prompts/             the document prompts and the required headings (data)
INTAKE_PROMPT.md             the interview prompt (used by `intake`, or pasted into claude.ai)
examples/business/           three sample business documents; tests/fixtures/plans/ holds the plans the real analyzer made from them
PROMPT.md                    Part A: prompt for an agent that sets up a system; Part B: filled into every repo as docs/AGENT_PROMPT.md
src/system_setup/manifest.py TEMPLATE.json contract
src/system_setup/engine.py   copy, substitute, rename, layers, targeted edits, verification, post_generate
src/system_setup/kmp.py      kmp snapshot identity check + fail-loud verification per app
src/system_setup/workspace.py projects.json, per-project files, knowledge, tasks.py check, git init + masters, next steps
templates/<kind>/            built by the template owners (workspace, server, admin, sdk, kmp)
templates/deploy/<host>/     per-host config and guide, per part kind (data; see Deployment); not a template kind
knowledge/                   LESSONS.md, PLAYBOOKS.md (copied into every generated workspace)
tests/                       unit + end-to-end tests on tests/fixtures/templates (+ tests/fixtures/knowledge)
tests/test_no_private_data.py  privacy guard: secret shapes + hashed deny list over every tracked file and file name
```
