import { MS_PER_SECOND } from './constants/defaults';
import { ERROR_CODES } from './constants/notifications';
import type { ResolvedConfig } from './config/options';
import { SdkError, configError, isSdkError } from './errors';
import {
  delayFor,
  isRetryable,
  realRetryDeps,
  withRetry,
  withTimeout,
  type RetryDeps,
} from './retry';
import type {
  EmailMessage,
  EmailReport,
  EmailSender,
  IdempotencyStore,
  Notifier,
  PushMessage,
  PushReport,
  PushSender,
  SendOptions,
  TokenResult,
} from './types';
import {
  assertEmailMessage,
  assertIdempotencyKey,
  assertPushMessage,
  distinctTokens,
} from './validation';

export interface NotifierDeps {
  readonly pushSender?: PushSender;
  readonly emailSender?: EmailSender;
  readonly idempotencyStore: IdempotencyStore;
  readonly retryDeps?: RetryDeps;
}

const chunk = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

/** Push + email behind one facade: validation, idempotency, chunking, retries, typed errors. */
export class NotifierService implements Notifier {
  private readonly retryDeps: RetryDeps;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly deps: NotifierDeps,
  ) {
    this.retryDeps = deps.retryDeps ?? realRetryDeps;
  }

  private async claim(channel: string, options: SendOptions | undefined): Promise<boolean> {
    assertIdempotencyKey(options?.idempotencyKey);
    if (options?.idempotencyKey === undefined) return true;
    return this.deps.idempotencyStore.claim(
      `${channel}:${options.idempotencyKey}`,
      this.config.idempotencyTtlSec * MS_PER_SECOND,
    );
  }

  private wrap(error: unknown, code: string, retryable: boolean): SdkError {
    return isSdkError(error)
      ? error
      : new SdkError(code, error instanceof Error ? error.message : String(error), {
          retryable,
          cause: error,
        });
  }

  async sendPush(message: PushMessage, options?: SendOptions): Promise<PushReport> {
    const sender = this.deps.pushSender;
    if (sender === undefined) throw configError('push is not configured', { fields: ['push'] });
    assertPushMessage(message);
    const tokens = distinctTokens(message);
    if (!(await this.claim('push', options))) return this.report([], true);
    // Every token starts FAILED: a vendor answer that omits a token leaves it failed.
    const results = new Map<string, TokenResult>(
      tokens.map((token) => [token, { token, status: 'FAILED' as const }]),
    );
    let pending = tokens;
    for (let attempt = 1; pending.length > 0; attempt += 1) {
      for (const batch of chunk(pending, this.config.maxTokensPerSend))
        for (const result of await this.sendBatch(sender, { ...message, tokens: batch }))
          results.set(result.token, result);
      pending = pending.filter((token) => results.get(token)?.status === 'RETRYABLE');
      if (pending.length === 0 || attempt >= this.config.retry.maxAttempts) break;
      await this.retryDeps.sleep(delayFor(attempt, this.config.retry, this.retryDeps.random));
    }
    return this.report(
      tokens.map((token) => results.get(token) as TokenResult),
      false,
    );
  }

  /** One vendor call with timeout + retry for whole-call failures. */
  private sendBatch(sender: PushSender, message: PushMessage): Promise<readonly TokenResult[]> {
    return withRetry(
      () =>
        withTimeout(sender.send(message), this.config.timeoutMs).catch((error: unknown) => {
          const wrapped = this.wrap(error, ERROR_CODES.PUSH_FAILED, true);
          // `reason`, not `code`: the redacting logger masks any field named like a secret code.
          this.config.logger.warn('push call failed', {
            sender: sender.name,
            reason: wrapped.code,
          });
          throw wrapped;
        }),
      this.config.retry,
      this.retryDeps,
    );
  }

  private report(results: readonly TokenResult[], duplicate: boolean): PushReport {
    const final = results.map((r): TokenResult =>
      r.status === 'RETRYABLE' ? { ...r, status: 'FAILED' } : r,
    );
    return {
      results: final,
      invalidTokens: final.filter((r) => r.status === 'INVALID_TOKEN').map((r) => r.token),
      sent: final.filter((r) => r.status === 'SENT').length,
      failed: final.filter((r) => r.status === 'FAILED').length,
      duplicate,
    };
  }

  async sendEmail(message: EmailMessage, options?: SendOptions): Promise<EmailReport> {
    const sender = this.deps.emailSender;
    if (sender === undefined) throw configError('email is not configured', { fields: ['email'] });
    assertEmailMessage(message);
    if (!(await this.claim('email', options))) return { id: '', status: 'QUEUED', duplicate: true };
    const result = await withRetry(
      () =>
        withTimeout(sender.send(message), this.config.timeoutMs).catch((error: unknown) => {
          const wrapped = this.wrap(error, ERROR_CODES.EMAIL_FAILED, false);
          this.config.logger.warn('email call failed', {
            sender: sender.name,
            reason: wrapped.code,
            retryable: isRetryable(wrapped),
          });
          throw wrapped;
        }),
      this.config.retry,
      this.retryDeps,
    );
    return { ...result, duplicate: false };
  }

  async close(): Promise<void> {
    await this.deps.pushSender?.close?.();
    await this.deps.emailSender?.close?.();
  }
}
