# Admin panel: end-to-end results on the local real stack

> Template of the report written after each end-to-end pass (`docs/REAL_SERVER_QA.md`). Replace the placeholders; keep the tables.

**Date:** YYYY-MM-DD · **Server:** `__SERVER_DIR__` at `<commit>` · **Panel:** `<variant>` at `<commit>` · **Admin:** the QA admin of `qa/stack.sh`

## Setup

- Server: `qa/stack.sh` (MongoDB replica set, Redis, the server with fake providers) at `127.0.0.1:4000`; `node qa/seed.mjs` once.
- Panel: `dev-release` built with `VITE_API_BASE_URL` / `VITE_SOCKET_URL` = the local server, served with `vite preview`.
- Sweep: every module route and the first detail page of each list, in six combinations (AR light 1440, EN dark 1440, AR dark 768, EN light 768, AR light 375, EN dark 375): horizontal overflow, error states, console.

## Results

| Area | What was done | Result |
|---|---|---|
| Sign-in + e-mail code | credentials → code → home | |
| Items | list, search, filter, archive, restore, details, history | |
| Settings | change a value with a reason, use default | |
| Audit log | every action above appears | |

## Admin defects found and fixed (all with unit tests)

| # | Defect | Fix |
|---|---|---|
| F1 | | |

## Server defects (not changed here)

| # | Endpoint / request | Expected | Actual |
|---|---|---|---|
| S1 | | | |

## Blocks / not exercised

- 
