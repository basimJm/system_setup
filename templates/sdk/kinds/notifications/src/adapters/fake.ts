import type { EmailStatus } from '../constants/notifications';
import type { EmailMessage, EmailSender, PushMessage, PushSender, TokenResult } from '../types';

const NAME = 'fake';

/**
 * Records pushes instead of sending them. Tokens listed in `invalid` come back `INVALID_TOKEN`,
 * tokens in `flaky` come back `RETRYABLE` once (then succeed); `failWith` fails whole calls.
 */
export class FakePushSender implements PushSender {
  readonly name = NAME;
  readonly isFake = true;
  readonly sent: PushMessage[] = [];
  readonly invalid = new Set<string>();
  readonly flaky = new Set<string>();
  failWith: Error | undefined;

  send(message: PushMessage): Promise<readonly TokenResult[]> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.sent.push(message);
    return Promise.resolve(
      message.tokens.map((token): TokenResult => {
        if (this.invalid.has(token))
          return { token, status: 'INVALID_TOKEN', errorCode: 'unregistered' };
        if (this.flaky.delete(token))
          return { token, status: 'RETRYABLE', errorCode: 'unavailable' };
        return { token, status: 'SENT' };
      }),
    );
  }

  /** Every token that reached `SENT` across all calls, in order. */
  delivered(): string[] {
    return this.sent.flatMap((m) => m.tokens.filter((t) => !this.invalid.has(t)));
  }
}

/** Records emails instead of sending them; `failWith` fails the next sends. */
export class FakeEmailSender implements EmailSender {
  readonly name = NAME;
  readonly isFake = true;
  readonly sent: EmailMessage[] = [];
  status: EmailStatus = 'SENT';
  failWith: Error | undefined;

  send(message: EmailMessage): Promise<{ readonly id: string; readonly status: EmailStatus }> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.sent.push(message);
    return Promise.resolve({ id: `${NAME}-${String(this.sent.length)}`, status: this.status });
  }
}
