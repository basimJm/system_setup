import { KERNEL_ERROR_CODES } from '../constants/codes';
import { isSdkError, SdkError } from '../errors';

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;
}

export interface RetryDeps {
  readonly sleep: (ms: number) => Promise<void>;
  /** Returns a number in [0, 1). */
  readonly random: () => number;
}

export const realRetryDeps: RetryDeps = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
};

/** Capped exponential backoff with symmetric jitter; `attempt` is the one that just failed (1-based). */
export const delayFor = (attempt: number, policy: RetryPolicy, random: () => number): number => {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  const jitter = exponential * policy.jitterRatio * (random() * 2 - 1);
  return Math.max(0, Math.round(exponential + jitter));
};

export const isRetryable = (error: unknown): boolean => isSdkError(error) && error.retryable;

/** Runs `operation`, retrying only errors the SDK marked retryable. */
export const withRetry = async <T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  deps: RetryDeps,
  onRetry?: (attempt: number, error: unknown) => void,
): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= policy.maxAttempts || !isRetryable(error)) throw error;
      onRetry?.(attempt, error);
      await deps.sleep(delayFor(attempt, policy, deps.random));
    }
  }
};

export const timeoutError = (timeoutMs: number): SdkError =>
  new SdkError(KERNEL_ERROR_CODES.TIMEOUT, 'operation timed out', {
    retryable: true,
    details: { timeoutMs },
  });

/** Rejects with a retryable `TIMEOUT` error when `work` takes longer than `timeoutMs`. */
export const withTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error = () => timeoutError(timeoutMs),
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(onTimeout());
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
};
