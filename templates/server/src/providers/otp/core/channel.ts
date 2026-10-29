import type { Language } from '../../../constants/i18n';
import type { OtpPurpose } from '../../../constants/providers';

/** One code to deliver. `language` is the app language; the channel maps it to its template. */
export interface OtpMessage {
  /** E.164 recipient. */
  readonly to: string;
  /** Never log it. */
  readonly code: string;
  readonly language: Language;
  readonly purpose: OtpPurpose;
  readonly ttlSec: number;
  /** End user's IP, when the caller passes one (vendors with per-IP limits use it). */
  readonly ip?: string;
}

/** A way to deliver a code (WhatsApp, SMS…). A refused recipient throws `OtpDeliveryError`. */
export interface OtpChannel {
  /** Short channel name for logs (`fake`, `sms`, `whatsapp`). */
  readonly name: string;
  /** A fake channel must say so: production refuses it. */
  readonly isFake?: boolean;
  send(message: OtpMessage): Promise<{ readonly id: string }>;
}

/** The recipient cannot receive codes (not reachable on the channel); retrying will not help. */
export class OtpDeliveryError extends Error {
  constructor(message = 'otp code not deliverable', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OtpDeliveryError';
  }
}

export const FAKE_CHANNEL_NAME = 'fake';

/** Records every code instead of delivering it (dev and tests). Refused in production. */
export class FakeOtpChannel implements OtpChannel {
  readonly name = FAKE_CHANNEL_NAME;
  readonly isFake = true;
  readonly sent: OtpMessage[] = [];
  /** Set to make the next sends fail (e.g. an `OtpDeliveryError`). */
  failWith: Error | undefined;

  send(message: OtpMessage): Promise<{ id: string }> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.sent.push({ ...message });
    return Promise.resolve({ id: `${FAKE_CHANNEL_NAME}-${String(this.sent.length)}` });
  }

  /** The last code sent to a phone (tests read it like a user reads the message). */
  lastCode(phone: string): string | undefined {
    return this.sent.findLast((message) => message.to === phone)?.code;
  }
}
