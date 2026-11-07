# **SYSTEM_NAME** — Server backlog

> Read only through `python3 scripts/tasks.py next|show|set|board|blocked|check server`. Branches come from `origin/server`; PRs target `server`. Statuses: TODO, IN PROGRESS, IN REVIEW, DONE, BLOCKED, PENDING.

| ID | Title | Branch | Needs | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| SRV-001 | Server scaffold from the SYSTEM_SETUP template      | `feat/srv-001-scaffold`      | —       | DONE    | `npm run verify` green; sample `items` feature in the three namespaces              |
| SRV-002 | Hosting: dev + prod environments, env files checked | `feat/srv-002-hosting`       | SRV-001 | PENDING | Owner: host, MongoDB, Redis (`__DEV_API_URL__`, `__PROD_API_URL__`)                 |
| SRV-003 | Real OTP channel (`__NPM_SCOPE__/otp`)              | `feat/srv-003-otp-real`      | SRV-001 | TODO    | `src/providers/otp/real.ts`; `OTP_PROVIDER=real`                                    |
| SRV-004 | Real storage (`__NPM_SCOPE__/storage`)              | `feat/srv-004-storage-real`  | SRV-001 | TODO    | `src/providers/storage/real.ts`                                                     |
| SRV-005 | Real notifier (`__NPM_SCOPE__/notifications`)       | `feat/srv-005-notifier-real` | SRV-001 | TODO    | `src/providers/notifier/real.ts`                                                    |
| SRV-006 | First real feature replaces the `items` sample      | `feat/srv-006-first-feature` | SRV-001 | TODO    | Domain section first (`docs/BUSINESS_DOMAIN.md`), then route → service → repository |
