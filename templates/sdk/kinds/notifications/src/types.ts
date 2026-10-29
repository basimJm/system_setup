import type { EmailStatus, Priority, TokenStatus } from './constants/notifications';

export interface PushMessage {
  /** Device tokens; de-duplicated and chunked by the notifier. */
  readonly tokens: readonly string[];
  readonly title?: string;
  readonly body?: string;
  /** String map delivered to the app (data message); size-bounded. */
  readonly data?: Readonly<Record<string, string>>;
  readonly priority?: Priority;
  /** Vendor collapse / group key when supported. */
  readonly collapseKey?: string;
}

export interface TokenResult {
  readonly token: string;
  readonly status: TokenStatus;
  /** Vendor code for logs; never secret. */
  readonly errorCode?: string;
}

export interface PushReport {
  readonly results: readonly TokenResult[];
  /** Tokens the consumer must delete (unregistered / malformed). */
  readonly invalidTokens: readonly string[];
  readonly sent: number;
  readonly failed: number;
  /** True when the idempotency key had already been used; nothing was sent. */
  readonly duplicate: boolean;
}

/** One vendor push call for at most `maxTokensPerSend` tokens; throws only for whole-call failures. */
export interface PushSender {
  readonly name: string;
  readonly isFake?: boolean;
  send(message: PushMessage): Promise<readonly TokenResult[]>;
  close?(): Promise<void>;
}

export interface EmailMessage {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly replyTo?: string;
  /** Vendor tags / headers for tracking; never secret. */
  readonly tags?: Readonly<Record<string, string>>;
}

export interface EmailReport {
  readonly id: string;
  readonly status: EmailStatus;
  readonly duplicate: boolean;
}

export interface EmailSender {
  readonly name: string;
  readonly isFake?: boolean;
  send(message: EmailMessage): Promise<{ readonly id: string; readonly status: EmailStatus }>;
  close?(): Promise<void>;
}

/** Remembers idempotency keys; a shared implementation is needed across processes. */
export interface IdempotencyStore {
  readonly scope: 'local' | 'shared';
  /** True when this call registered the key (first use). */
  claim(key: string, ttlMs: number): Promise<boolean>;
}

export interface SendOptions {
  /** Same key within the TTL → nothing is sent, `duplicate: true`. */
  readonly idempotencyKey?: string;
}

/** The port: one facade for push and email. */
export interface Notifier {
  sendPush(message: PushMessage, options?: SendOptions): Promise<PushReport>;
  sendEmail(message: EmailMessage, options?: SendOptions): Promise<EmailReport>;
  close(): Promise<void>;
}
