import { IdempotencyStore } from '../idempotency';
import type { EmailRequest, EmailResult, Notifier, PushRequest, PushResult } from './types';
import { assertEmailRequest, assertPushRequest } from './validation';

/** In-memory stand-in for FCM + SMTP (dev/test only; production config refuses it). */
export class FakeNotifier implements Notifier {
  /** Every push that was really delivered, in order (idempotent repeats are not added). */
  readonly pushes: PushRequest[] = [];
  readonly emails: EmailRequest[] = [];
  private readonly invalidTokens = new Set<string>();
  private readonly failedTokens = new Set<string>();
  private readonly rejectedAddresses = new Set<string>();
  private readonly pushStore = new IdempotencyStore<PushResult>();
  private readonly emailStore = new IdempotencyStore<EmailResult>();

  /** Test helper: the provider reports this token as unregistered. */
  markTokenInvalid(token: string): void {
    this.invalidTokens.add(token);
  }

  /** Test helper: delivery to this token fails (transient). */
  markTokenFailing(token: string): void {
    this.failedTokens.add(token);
  }

  /** Test helper: the mail server refuses this address. */
  markAddressRejected(address: string): void {
    this.rejectedAddresses.add(address);
  }

  sendPush(request: PushRequest): Promise<PushResult> {
    return this.guard(() => {
      assertPushRequest(request);
      return this.pushStore.run(request.idempotencyKey, JSON.stringify(request), () => {
        this.pushes.push(request);
        const tokens =
          'tokens' in request.target
            ? request.target.tokens.map((token) => ({
                token,
                result: this.invalidTokens.has(token)
                  ? ('INVALID_TOKEN' as const)
                  : this.failedTokens.has(token)
                    ? ('FAILED' as const)
                    : ('SENT' as const),
              }))
            : [];
        const sent =
          'tokens' in request.target ? tokens.filter((entry) => entry.result === 'SENT').length : 1;
        return Promise.resolve({
          tokens,
          sent,
          invalidTokens: tokens.filter((e) => e.result === 'INVALID_TOKEN').map((e) => e.token),
        });
      });
    });
  }

  sendEmail(request: EmailRequest): Promise<EmailResult> {
    return this.guard(() => {
      assertEmailRequest(request);
      return this.emailStore.run(request.idempotencyKey, JSON.stringify(request), () => {
        this.emails.push(request);
        return Promise.resolve({
          accepted: request.to.filter((address) => !this.rejectedAddresses.has(address)),
          rejected: request.to.filter((address) => this.rejectedAddresses.has(address)),
        });
      });
    });
  }

  /** Caller bugs reject like a real async API instead of throwing synchronously. */
  private guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return work();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
