# **SERVER_DIR** — Integration (what this project provides and consumes)

> Read when a task touches a contract, a provider or another project. The cross-project map is `INTEGRATION.md` at the repo root; this file is the server's side of it.

## Provides

| To           | Contract                                                          | Where generated                                               | Live state                                         |
| ------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| Customer app | `/customer/v1` (`docs/api/openapi.customer.json`)                 | `<feature>.openapi.ts` → `src/docs/index.ts` → `npm run docs` | OTP, auth, profile, uploads, notifications, items  |
| Merchant app | `/merchant/v1` (`docs/api/openapi.merchant.json`)                 | same                                                          | OTP, auth, me, team, uploads, notifications, items |
| Admin panel  | `/admin/v1` (`docs/api/openapi.admin.json`)                       | same                                                          | auth, settings, audit log, uploads, items          |
| All clients  | `/health`, `/ready`, `/webhooks/payments` (`openapi.common.json`) | same                                                          | —                                                  |
| All clients  | Socket.IO namespaces `/customer`, `/merchant`, `/admin`           | `src/sockets/*`                                               | account, item and overview events                  |

Clients regenerate their DTOs from the OpenAPI files (admin: `npm run api:sync`; apps: `./gradlew apiSync`). Every contract change is additive and recorded with `npm run contract:bump -- <name> "<client tasks to re-sync>"`.

## Consumes

| From                          | How                                                  | Mode                                                          |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `__NPM_SCOPE__/otp`           | `src/providers/otp/real.ts` (`createRealOtpChannel`) | `OTP_PROVIDER=real`; fake records codes (dev/test)            |
| `__NPM_SCOPE__/storage`       | `src/providers/storage/real.ts`                      | `STORAGE_PROVIDER=real`; fake = in-memory presign/confirm/CDN |
| `__NPM_SCOPE__/notifications` | `src/providers/notifier/real.ts`                     | `NOTIFIER_PROVIDER=real`; fake records pushes and emails      |
| `__NPM_SCOPE__/payments`      | `src/providers/payments/real.ts`                     | `PAYMENT_PROVIDER=real                                        | disabled`; fake gateway by reference suffix |
| `__NPM_SCOPE__/analytics`     | `src/providers/analytics/mongo.ts` today             | `ANALYTICS_PROVIDER=real` = server events in MongoDB          |
| MongoDB, Redis                | `MONGODB_URI`, `REDIS_URL`                           | Managed services in dev/prod; docker compose locally          |

## Environments

| Env  | API                | Notes                                                   |
| ---- | ------------------ | ------------------------------------------------------- |
| dev  | `__DEV_API_URL__`  | `docker/env.dev.example`; `SEED_DEV_ON_START` allowed   |
| prod | `__PROD_API_URL__` | `docker/env.prod.example`; fakes and fixed code refused |
