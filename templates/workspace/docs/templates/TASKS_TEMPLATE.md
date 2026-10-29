# <Project> — Task Backlog

> **Purpose:** every task needed to build this part, small and ordered, with a status. One task = one branch = one PR (batched verification may merge five at once, see rules §3.13).
> **Sources read when writing this backlog:** root `CLAUDE.md`, this project's `CLAUDE.md`, `BUSINESS_DOMAIN.md`, `INTEGRATION.md`, this project's PRD/BRD and the matching sections of the other projects' PRDs.
> **Never read this file whole.** Pick the next task with `python3 scripts/tasks.py next <project>`; show one with `show <ID>`; change status with `set <ID> <STATUS>`; counts with `board`.

Writing rules:
- Order rows so that each task builds on merged ones; a row needing work from another project lists that id in `Needs` and starts as `BLOCKED` (never `TODO` — `check` rejects it).
- Size: half a day of agent work or less; split larger rows into `NNNa`, `NNNb`.
- `Notes` names exactly what to read: `PRD S07, F02; BUSINESS_DOMAIN §5.6; ops: postBookings, getSlots`. Owner-dependent rows: `PENDING` + `**owner input**: <what>`.
- Stages (`## Stage A — …`) group rows for humans; the tool ignores headings and reads every `| <PREFIX>-NNN |` row under any `| ID |` header.

## Stage A — Foundation
| ID | Title | Branch | Needs | Status | Notes |
|---|---|---|---|---|---|
| XXX-001 | Scaffold, gate command, lint, test runner | `feat/xxx-001-scaffold` | — | TODO | project `CLAUDE.md` §1; no ops |
| XXX-002 | Config loader and env schema (`.env.example` enforced by a test) | `feat/xxx-002-config` | XXX-001 | TODO | no ops |
| XXX-003 | Contract sync from the server OpenAPI | `feat/xxx-003-contract` | XXX-001, SRV-0NN | BLOCKED | `INTEGRATION.md` §2 |

## Stage B — <first feature family>
| ID | Title | Branch | Needs | Status | Notes |
|---|---|---|---|---|---|

## Stage Z — End-of-backlog checks (rules §3.13)
| ID | Title | Branch | Needs | Status | Notes |
|---|---|---|---|---|---|
| XXX-0NN | Full gate + end-to-end journey; fix findings | `feat/xxx-0nn-e2e` | all above | TODO | emulator + simulator (apps) / browser (web) |
