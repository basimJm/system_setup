# Providers (ports + adapters)

Every external service sits behind one interface (`<name>/types.ts`) that services receive by injection. `*_PROVIDER=fake|real` (`PAYMENT_PROVIDER` also `disabled`) picks the implementation in `src/providers/index.ts`:

| Provider    | Port                | Fake (dev/test)                                                                                                                                              | Real (production)                                                                                                                      |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `otp`       | `OtpProvider`       | `FakeOtpProvider`: the full code flow (HMAC codes with TTL, single use, signed `otpToken`) over a channel that records codes (`OTP_FIXED_CODE` for local QA) | `createRealOtp`: the same core over the channel you plug into `otp/real.ts` (`createRealOtpChannel`), e.g. the `__NPM_SCOPE__/otp` SDK |
| `storage`   | `StorageProvider`   | `FakeStorageProvider` (in-memory presign / confirm / CDN URLs)                                                                                               | `createRealStorage` in `storage/real.ts`, e.g. the `__NPM_SCOPE__/storage` SDK (S3 + CDN)                                              |
| `notifier`  | `Notifier`          | `FakeNotifier` (records pushes and emails; idempotent)                                                                                                       | `createRealNotifier` in `notifier/real.ts`, e.g. the `__NPM_SCOPE__/notifications` SDK (FCM + SMTP)                                    |
| `payments`  | `PaymentProvider`   | `FakePaymentProvider` (scenario by reference suffix `@fail`, `@cancel`, `@pending`)                                                                          | `createRealPayments` in `payments/real.ts`, e.g. the `__NPM_SCOPE__/payments` SDK; `disabled` answers 503                              |
| `analytics` | `AnalyticsProvider` | `FakeAnalyticsProvider` (in memory)                                                                                                                          | `createMongoAnalytics` over the append-only `serverEvents` collection (replace with the `__NPM_SCOPE__/analytics` SDK when one exists) |

## Plugging an SDK adapter

1. Add the package (`npm i __NPM_SCOPE__/<sdk>`) and its settings to `src/config` (env keys in `src/constants/env.ts`, hints in `envHints.ts`, keys listed in `.env.example`; required-when-real rules in `env.schema.ts`).
2. Implement the port in `src/providers/<name>/real.ts`. Map every SDK failure to a typed error (`ExternalServiceError` for outages, `PaymentError`, `OtpDeliveryError`) so vendor text never reaches a client and secrets never reach a log.
3. Keep business rules out of the adapter: recipients, languages, policies and limits belong to `src/domain`.
4. Add a unit test with the SDK mocked, and run `npm run verify`. Production refuses fakes: a real adapter that is still a stub fails at startup with a `ProviderUnavailableError` naming the file to implement.
