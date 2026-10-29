# `__NPM_SCOPE__/__SDK_KIND__` — __SDK_TITLE__ SDK for __SYSTEM_NAME__

Provider-independent __SDK_KIND__ behind one interface (port). Vendors live in adapters chosen by
configuration; the package contains **no business rules** of __SYSTEM_NAME__.

## Quick start
```ts
import { create__SDK_TITLE__ } from '__NPM_SCOPE__/__SDK_KIND__';

// dev: fake / memory adapters, no credentials, works on localhost
const sdk = create__SDK_TITLE__({ environment: 'dev', provider: 'fake' });
```
Production (`environment: 'prod'`) refuses fake and process-local adapters, requires HTTPS endpoints
and the secrets of the real adapter (`__SDK_PREFIX___CONFIG_INVALID` names the field, never the value).

## Layout
```
src/
  index.ts  kernel.ts                         # public surface
  constants/ config/ errors/ logger/ retry/   # shared kernel (same in every __SYSTEM_SLUG__-* SDK)
  types.ts                                    # ports (the stable interface)
  adapters/<name>/                            # one folder per vendor / fake / memory
tests/  tests/loop/                           # unit tests (coverage gate) + loop test
scripts/package-smoke.cjs                     # consumer smoke (CJS + ESM) with scripts/smoke.body.cjs
docs/__SDK_TITLE___BRD.md  docs/__SDK_TITLE___Tasks.md
.claude/Rules.md  .claude/Integration.md  .claude/session.md  .claude/memory.md
```

## Commands
`npm run verify` = typecheck + lint + format check + `jest --coverage` (100 % functions, 95 %
lines/branches) + build (ESM + CJS + `.d.ts`) + package smoke + loop test. Run it before every push.

## Where things are documented
- How it is built and how any project uses it: `.claude/Integration.md` (kept current after every change).
- Requirements: `docs/__SDK_TITLE___BRD.md`; backlog: `docs/__SDK_TITLE___Tasks.md`.
- Server counterpart (the consumer): `../__SERVER_DIR__`.
