import { ERROR_CODES } from './constants/sdk';
import type { ResolvedConfig } from './config/options';
import { SdkError, isSdkError } from './errors';
import { realRetryDeps, withRetry, withTimeout, type RetryDeps } from './retry';
import type {
  __SDK_TITLE__Client,
  __SDK_TITLE__Port,
  __SDK_TITLE__Request,
  __SDK_TITLE__Result,
} from './types';
import { assertRequest } from './validation';

/** The facade around a port: validation, timeout, retries (only for errors marked retryable), typed errors. */
export class __SDK_TITLE__Service implements __SDK_TITLE__Client {
  constructor(
    private readonly config: ResolvedConfig,
    private readonly adapter: __SDK_TITLE__Port,
    private readonly retryDeps: RetryDeps = realRetryDeps,
  ) {}

  async execute(request: __SDK_TITLE__Request): Promise<__SDK_TITLE__Result> {
    assertRequest(request);
    return await withRetry(
      () =>
        withTimeout(this.adapter.execute(request), this.config.timeoutMs).catch((error: unknown) => {
          const wrapped = isSdkError(error)
            ? error
            : new SdkError(ERROR_CODES.OPERATION_FAILED, 'the adapter call failed', {
                retryable: false,
                cause: error,
              });
          // `reason`, not `code`: the redacting logger masks any field named like a secret code.
          this.config.logger.warn('call failed', { adapter: this.adapter.name, reason: wrapped.code });
          throw wrapped;
        }),
      this.config.retry,
      this.retryDeps,
    );
  }

  async close(): Promise<void> {
    await this.adapter.close?.();
  }
}
