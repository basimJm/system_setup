# Roadmap

Read this file and the phase you are given. Do not read the templates to get the picture.

## Goal
Anyone can describe a business in their own language and get a complete, ready-to-build multi-project system: documents,
backlogs, code skeletons, SDKs, deployment files, rules and lessons. It must work for any business, stay easy to change after
creation, and be easy for vibe coders and developers alike.

## The flow
1. `SYSTEM_SETUP intake`: Claude talks with the person in their language until the picture is complete and writes `BUSINESS.md`.
   `INTAKE_PROMPT.md` is the same conversation for pasting into claude.ai.
2. `SYSTEM_SETUP new`: asks for the document, analyzes it, and proposes a plan.
3. The person reviews the plan: modules, platforms, SDKs, the source and provider of each SDK, deployment, rules. Anything can change.
4. The tool generates everything from the plan.
5. `SYSTEM_SETUP update`: the business changes later, the system follows without losing work.
6. `SYSTEM_SETUP lessons import <project>`: what a project learned returns to the tool after review.

## Design rules
- The engine stays standard-library Python 3.9 with no dependencies.
- Models are used only in the analysis and document steps, through `claude -p` with `--json-schema`, few tools, no MCP and a
  budget cap, behind one `Analyzer` seam. Tests use a fake analyzer. `--plan FILE` runs with no model at all.
- `system.plan.json` (versioned, validated) is the only input of generation. Generation is deterministic and uses no model.
- Lists are data, not code: `catalog/modules.json`, `sdks.json`, `providers.json`, `deploy.json`, `rules.json`. Adding a choice
  needs no code change.
- Never ask for secret values. Only environment key names are recorded, in `.env.example`.
- Never invent a business answer. A gap becomes a question, then an open point, then a `PENDING` backlog row.
- Every phase ships with tests, and real-model or real-build proof is reported as measured. Say plainly what was not proven.

## Phases
Each phase is one branch and one PR into `main`.

### 1. Extract and clean
- [x] Clean tree, committed on top of the existing history; the older commits stay in the log (owner decision).
- [x] No secret, private name, absolute path or brand left; a test and CI keep it so (hashed word list + secret patterns).
- [x] Every font, image and skill has a known open license or is removed; `THIRD_PARTY_NOTICES.md` lists them.
- [x] `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, PR and issue templates, `CODEOWNERS`, CI.
- [x] Tool tests pass, and a generated system passes `tasks.py check` with no leftovers.

### 2. Intake and plan
- [x] `intake`, `INTAKE_PROMPT.md` and `new`: a free-form document in any language becomes a validated `system.plan.json`.
      Proven with the real analyzer on three documents (one Arabic), $0.16 to $0.24 each. Not proven: a live, interactive `intake`
      interview (its `claude` arguments and greeting were checked in print mode only).
- [x] The plan proposes modules, platforms per module, SDKs (only those needed, including new ones), deployment and open questions.
- [x] Review asks each choice, with the proposal as default: per module web, Android, iOS; per SDK build internally, already
      published (package + version) or none, then the provider; per part the host. Tested with scripted answers, not with a person.
- [x] Three different sample businesses give different plans: a booking marketplace, a grocery store with delivery, and a
      web-only school fee portal.

### 3. Documents and backlogs
- [x] From the plan and the document: `BUSINESS_DOMAIN.md`, per module BRD, PRD, Design Script and backlog, plus `INTEGRATION.md`,
      a starting API contract and the root and project `CLAUDE.md` facts.
- [x] One small model call per document, resumable, with a total budget and a printed cost.
- [x] Backlogs pass `tasks.py check`, server tasks first, clients `BLOCKED` on them, and every open question is a `PENDING` row.
- [x] Nothing from a previous business appears in the output.
  Proof: school portal 14 documents, 79 tasks, $1.74; Arabic marketplace 20 documents, 124 tasks, $3.14; `tasks.py check` OK, privacy scan
  clean, re-run skipped all 20 at $0. The last box is only true for the documents: the server template still ships `merchant` and
  `customer` modules, fixed in Phase 8.

### 4. Modules and platforms
- [x] A `web` module kind (customer or merchant web app) built from the web template; any number of apps and web apps.
- [x] Platform choice removes unused folders, Gradle targets and CI jobs. A web-only and an Android-only system both build.

### 5. SDKs and providers
- [x] SDK and provider lists as data. Real adapters ported from the source system where they exist. (fcm, smtp, http-sms; s3 family builtin; payments and analytics adapters of the source were not ported)
- [x] A new SDK or unknown provider gets a skeleton: port, fake adapter, contract test, failing adapter test, backlog row.
- [x] A published SDK records package and version, creates no folder, and the server depends on it.

### 6. Deployment
- [ ] A host per part from `deploy.json` (Render, Docker on a server, AWS, Fly, Railway, Cloudflare, Vercel) or `custom`.
- [ ] Config and a guide for the chosen host only; no host name left in anything else. Configs are validated; a real deploy
      happens only where an account exists, and the report says which.

### 7. Rules and lessons
- [x] Each rule has an ID and can be on, off or edited in the plan; hooks follow it; turning off a safety rule asks to confirm.
- [x] Each lesson has an ID, tags and how it is enforced (rule, policy check, template or note). A project gets what matches its modules.
- [x] The task block gains `Lesson: <one line or none>`; `tasks.py set DONE` collects them in `docs/knowledge/LESSONS.local.md`.
- [x] `lessons import <project>` removes duplicates and business names, shows a diff and adds only what is approved.
- [x] The source system's recent lessons are harvested, generalized and added.

### 8. Update and full proof
- [ ] Server audiences come from the plan: no `merchant` or `customer` module, route or contract unless the plan has that audience.
- [ ] `update` adds a module or SDK and refreshes documents without overwriting work.
- [ ] The fallback time zone is `UTC` and any zone or currency works without editing template tests (today the fallback is
      `Etc/GMT-3` and template tests pin it).
- [ ] End to end on the three samples: generated, checked, built, first task run through the production line.

### 9. Release
- [ ] README with every feature, a quick start for vibe coders and for developers, and measured token numbers.
- [ ] Final privacy scan, owner confirms, repository public, `main` accepts changes only through PRs with passing checks.
- [ ] LinkedIn post text and images, every claim backed by a measurement or a shipped feature.
