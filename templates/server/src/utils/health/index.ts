import { HEALTH_STATUS, READINESS_CHECK_TIMEOUT_MS } from '../../constants/health';
import { withTimeout } from '../async/timeout';

/** A dependency probe (MongoDB ping, Redis ping...). Resolve = healthy, throw/reject = down. */
export interface ReadinessCheck {
  readonly name: string;
  readonly check: () => Promise<void>;
}

export interface ReadinessResult {
  readonly name: string;
  readonly status: typeof HEALTH_STATUS.up | typeof HEALTH_STATUS.down;
  /** Only for logging; never sent to clients. */
  readonly error?: unknown;
}

/** Runs all checks in parallel, each bounded by a timeout. Never rejects. */
export const runReadinessChecks = (
  checks: readonly ReadinessCheck[],
  timeoutMs: number = READINESS_CHECK_TIMEOUT_MS,
): Promise<ReadinessResult[]> =>
  Promise.all(
    checks.map(async ({ name, check }): Promise<ReadinessResult> => {
      try {
        await withTimeout(check(), timeoutMs);
        return { name, status: HEALTH_STATUS.up };
      } catch (error) {
        return { name, status: HEALTH_STATUS.down, error };
      }
    }),
  );
