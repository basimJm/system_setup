# **SERVER_DIR** — Memory (durable server facts; keep short, replace instead of append)

- Stack: Node 22, Express 5, Mongoose 9, ioredis, Socket.IO (Redis adapter), BullMQ, zod 4, TypeScript strict. Gate: `npm run verify`.
- Namespaces `/customer/v1`, `/merchant/v1`, `/admin/v1`; JWT scopes `customer|merchant|admin`; `Accept-Language: ar|en` (default `ar`).
- Auth: phone OTP (`POST …/auth/otp/request` → `…/auth/otp/verify` → single-use `otpToken` → login/register/change-phone); admin email + password + emailed code. Refresh tokens rotate; reuse revokes the family.
- Merchant: OWNER (all permissions, manages the team) and STAFF with a grant from `PERMISSIONS`; `loadMember` reads the member on every request so changes apply at once. Items of a merchant belong to the tenant (the owner's id).
- Providers: `OTP|STORAGE|NOTIFIER|ANALYTICS_PROVIDER=fake|real`, `PAYMENT_PROVIDER=fake|real|disabled`; production refuses fakes; real adapters live in `src/providers/<name>/real.ts` (`__NPM_SCOPE__/<sdk>`).
- Contract = generated `docs/api/openapi.{common,customer,merchant,admin}.json` (+ Postman); `npm run docs` after every endpoint change; `npm run contract:bump` records the fingerprint and client impact.
- Tests that need Redis spawn a local `redis-server` (or use `REDIS_TEST_URL`); everything else runs on in-memory fakes (`tests/helpers/fakeModel.ts`).
