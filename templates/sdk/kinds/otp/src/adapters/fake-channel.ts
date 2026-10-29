import type { OtpChannel, OtpMessage } from '../types';

const NAME = 'fake';

/** Records every code instead of sending it; `lastCode(phone)` is what a test or QA tool reads. */
export class FakeOtpChannel implements OtpChannel {
  readonly name = NAME;
  readonly isFake = true;
  readonly sent: OtpMessage[] = [];
  /** Set to make the next sends fail with this error until cleared. */
  failWith: Error | undefined;
  private counter = 0;

  send(message: OtpMessage): Promise<{ readonly id: string }> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.sent.push(message);
    this.counter += 1;
    return Promise.resolve({ id: `${NAME}-${String(this.counter)}` });
  }

  lastCode(phone: string): string | undefined {
    for (let i = this.sent.length - 1; i >= 0; i -= 1) {
      const message = this.sent[i];
      if (message?.to === phone) return message.code;
    }
    return undefined;
  }
}
