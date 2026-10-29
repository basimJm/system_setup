# <Project> — Integration (what this part exposes and consumes)

> Read with root `INTEGRATION.md` §1–§6 when a task touches another project. Keep it current: a task that adds an endpoint, event, port, env key or mock updates this file in the same PR.

## 1. Exposes
- REST operations (by operation id; the generated OpenAPI is the contract), real-time events, SDK ports/interfaces, published package name + version.

## 2. Consumes
- Server operations / SDK ports / third parties, each with: contract location, the fake or mock used on dev, and the env keys (names only) a live run needs.

## 3. Mocks and fakes
- How to run this part with no other part alive (`*_PROVIDER=fake`, `DATA_SOURCE=mock`, fixture files) and which flows the mock does not cover.

## 4. Env keys (names only, never values)
| Key | Required on | Purpose |
|---|---|---|

## 5. Dependencies on other projects' tasks
- Rows of this backlog that are BLOCKED on other projects, and the server/SDK tasks that will unblock them.
