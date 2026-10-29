/** Load-test tool: common reads answer within ~300 ms at p95. */
export const LOADTEST_P95_TARGET_MS = 300;
/** Share of failed requests (non-2xx or network errors) a run may have. */
export const LOADTEST_ERROR_BUDGET = 0.01;
export const LOADTEST_DEFAULT_CONCURRENCY = 20;
export const LOADTEST_DEFAULT_DURATION_SEC = 30;
export const LOADTEST_REQUEST_TIMEOUT_MS = 10_000;
export const LOADTEST_ENV = {
  baseUrl: 'LOADTEST_BASE_URL',
  customerToken: 'LOADTEST_CUSTOMER_TOKEN',
  concurrency: 'LOADTEST_CONCURRENCY',
  durationSec: 'LOADTEST_DURATION_SEC',
} as const;
export const LOADTEST_PERCENTILES = [50, 95, 99] as const;
