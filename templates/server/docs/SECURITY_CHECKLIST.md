# **SYSTEM_NAME** server — security checklist

Each control with the code that implements it and the test or configuration that proves it. `tests/securityChecklist.test.ts` fails when a file named here does not exist, so this list cannot drift away from the code silently.

Status: **DONE** (implemented and tested), **PLATFORM** (belongs to hosting/ops), **PARTIAL** (what is missing is stated).

| #   | Control                                           | Status   | Implementation                                                                                                  | Proof                                                                            |
| --- | ------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Helmet security headers                           | DONE     | `src/middlewares/security.ts`                                                                                   | `tests/security.test.ts`                                                         |
| 2   | HTTPS only                                        | PLATFORM | Helmet HSTS in `src/middlewares/security.ts`; TLS termination at the load balancer                              | `tests/security.test.ts` (HSTS header)                                           |
| 3   | CORS limited to the admin domain                  | DONE     | `src/middlewares/security.ts`, `src/config/env.schema.ts` (`CORS_ALLOWED_ORIGINS`)                              | `tests/security.test.ts`                                                         |
| 4   | Global and per-family rate limits                 | DONE     | `src/middlewares/rateLimit.ts`, `src/modules/shared/rateLimits/index.ts`, `src/utils/redis/rateLimitStore.ts`   | `tests/security.test.ts`, `tests/limiter.test.ts`                                |
| 5   | OTP abuse limits, hashed codes, single-use proofs | DONE     | `src/domain/otp/otpGate.service.ts`, `src/domain/otp/phoneOtp.service.ts`, `src/providers/otp/core/codeFlow.ts` | `tests/otp.test.ts`, `tests/phoneOtp.test.ts`, `tests/otpCore.test.ts`           |
| 6   | Schema validation of every input                  | DONE     | `src/middlewares/validate.ts` (zod) on every route                                                              | `tests/validate.test.ts` and each feature's 400 cases                            |
| 7   | NoSQL-injection and XSS sanitization              | DONE     | `src/utils/sanitize/index.ts`, `src/middlewares/sanitize.ts`                                                    | `tests/security.test.ts`                                                         |
| 8   | Request size limits                               | DONE     | `src/constants/server.ts` (`JSON_BODY_LIMIT`), `src/utils/errors/normalize.ts` (413)                            | `tests/app.test.ts`, `tests/errorNormalize.test.ts`                              |
| 9   | Short-lived JWT, separate token scopes            | DONE     | `src/utils/auth/accessToken.ts`, `src/middlewares/auth.ts`                                                      | `tests/auth.test.ts`, `tests/securityChecklist.test.ts` (every admin route)      |
| 10  | Rotating, revocable refresh tokens                | DONE     | `src/domain/auth/refreshTokens.service.ts` (hashed, family revocation)                                          | `tests/refreshTokens.test.ts`                                                    |
| 11  | Permission and ownership checks                   | DONE     | `src/middlewares/permission.ts`, `src/domain/permissions/permissions.ts`; items scoped by owner / tenant        | `tests/permissions.test.ts`, `tests/items.test.ts`, `tests/merchantAuth.test.ts` |
| 12  | Admin: bcrypt + email second factor + lockout     | DONE     | `src/utils/auth/password.ts`, `src/domain/auth/adminLogin.service.ts`, `src/domain/auth/adminAuth.service.ts`   | `tests/password.test.ts`, `tests/adminLogin.test.ts`, `tests/adminAuth.test.ts`  |
| 13  | Encryption of sensitive fields                    | PARTIAL  | `src/utils/crypto/aesGcm.ts` (AES-256-GCM) with `FIELD_ENCRYPTION_KEY`; no field uses it yet in the template    | `tests/config.test.ts` (key validation)                                          |
| 14  | File type/size validation, private documents      | DONE     | `src/domain/uploads/uploads.service.ts`, `src/constants/uploads.ts`                                             | `tests/uploads.test.ts`                                                          |
| 15  | Webhook signature verification                    | DONE     | `src/modules/webhooks/webhooks.routes.ts` (raw body), `src/providers/payments/fake.ts` (reference behaviour)    | `tests/docs.test.ts` (route), adapter tests when the real gateway is plugged in  |
| 16  | Secrets only in environment / secret stores       | DONE     | `src/config/index.ts` (fails fast, no defaults for secrets), `.env*` ignored by git, `.env.example` keys only   | `tests/config.test.ts`, `tests/checkEnv.test.ts`                                 |
| 17  | No sensitive data in logs                         | DONE     | `src/utils/logger/redact.ts` (tokens, OTP, passwords, keys; phones masked)                                      | `tests/logger.test.ts`                                                           |
| 18  | Admin audit log, every write with a reason        | DONE     | `src/domain/audit/audit.service.ts`, append-only `src/models/auditLog.model.ts`                                 | `tests/audit.test.ts`, `tests/items.test.ts`                                     |

## Known gaps and decisions

- **HTTPS and backups** are hosting concerns (TLS at the edge, managed MongoDB backups).
- **Access tokens are not revocable** before expiry (`auth.accessTokenTtlSec`); revocation is by refresh-token family.
- **Customer and merchant route protection** is proven per feature (401/403 cases in each feature's tests) and by the scope matrix in `tests/auth.test.ts`; the admin namespace has the all-routes audit because its guard is one shared middleware.
