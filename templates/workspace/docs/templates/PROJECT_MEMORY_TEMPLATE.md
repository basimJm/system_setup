# <Project> — Memory (durable facts; keep short, replace instead of append)

> Loaded on every turn in this folder. Only facts that save a future session an investigation: decisions with dates, paths, commands, gotchas. Nothing the code, git history or the backlog already records.

## Rules and flow
- Gate command, unit-test-only command, contract sync command, local run command (and that servers need the Terminal panel).
- Branching: master `<master>`; task branches `feat/<prefix>-NNN-<key>`; PRs into `<master>`.

## Per-task facts (<PREFIX>-NNN)
- `<PREFIX>-001 done:` what was added and how to use it (one line per task; merge or delete when superseded).

## Gotchas
- Build/toolchain quirks (memory limits, daemon collisions, lint rules that need a reasoned exception, test-framework traps).
