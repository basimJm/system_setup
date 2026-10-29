# **ADMIN_DIR** — Integration (what this project consumes)

> Read when a task touches the API, realtime or the mock.

## Consumes

| Dependency                | Contract                                                                                                                            | How                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Server `/admin/v1`        | `../__SERVER_DIR__/docs/api/openapi.admin.json` → `contract/openapi.admin.json` + `src/data/contract/generated/{dto,operations}.ts` | `npm run api:sync`; repositories call `container.api` with `defineEndpoint(OPERATIONS.x, {data, query?, body?})` |
| Server Socket.IO `/admin` | events → `constants/realtime.ts` (event → query invalidations)                                                                      | `container.realtime`                                                                                             |
| Auth                      | login `{otpRequired, expiresAt, resendAfterSeconds}` → verify-otp `{email, code}` → refresh / logout (resend = login again)         | `container.sessionManager`                                                                                       |
| Mock                      | fixture routes per operation (`data/mock/fixtures.ts`) served through the real HTTP client; scenarios                               | `VITE_DATA_SOURCE=mock` (dev builds only)                                                                        |

## Environment (public values only; keys in `.env.example`)

`VITE_API_BASE_URL`, `VITE_SOCKET_URL` (https required in prod), `VITE_DATA_SOURCE=mock|remote`, `VITE_DEFAULT_LANGUAGE=ar|en`, build variants `<dev|prod>-<debug|release>`.

## Waiting on

- Dev API URL (`__DEV_API_URL__`) and prod API URL (`__PROD_API_URL__`) deployed with CORS for the panel origins.
- Hosting / domain (ADM-007, owner).

## Gate

`sh scripts/gate.sh` (verify, four variant builds, `check:size`) + browser UI check before every commit (`.claude/rules.md` §6); e2e on request. QA against the real server: `docs/REAL_SERVER_QA.md`.
