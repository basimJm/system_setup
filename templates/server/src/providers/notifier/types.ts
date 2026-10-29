import type {
  PushApp,
  PushInterruptionLevel,
  PushKind,
  PushPriority,
  PushTokenResult,
} from '../../constants/providers';

export interface PushMessage {
  readonly app: PushApp;
  /** `DATA_ONLY` is silent: no title or body, only `data`. */
  readonly kind: PushKind;
  /** Already localized to the recipient's language by the caller. */
  readonly title?: string;
  readonly body?: string;
  /** Deep-link and state payload; FCM data values are strings. */
  readonly data?: Readonly<Record<string, string>>;
  readonly priority?: PushPriority;
  /** iOS interruption level for time-sensitive requests. */
  readonly interruption?: PushInterruptionLevel;
  /** iOS action category (Accept / Reject buttons). */
  readonly actionCategory?: string;
  readonly sound?: string;
  readonly badge?: number;
  readonly androidChannelId?: string;
  readonly androidFullScreenIntent?: boolean;
  /** Messages with the same key replace each other on the device (FCM collapse key / apns-collapse-id). */
  readonly collapseKey?: string;
}

export type PushTarget = { readonly tokens: readonly string[] } | { readonly topic: string };

export interface PushRequest {
  readonly target: PushTarget;
  readonly message: PushMessage;
  /** One logical notification = one key, so a retry never sends it twice. */
  readonly idempotencyKey: string;
}

export interface PushResult {
  /** Per token, in request order; empty for topic sends. */
  readonly tokens: readonly { readonly token: string; readonly result: PushTokenResult }[];
  readonly sent: number;
  /** Tokens the provider reports as unregistered: the caller deletes them. */
  readonly invalidTokens: readonly string[];
}

export interface EmailRequest {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly idempotencyKey: string;
}

export interface EmailResult {
  readonly accepted: readonly string[];
  readonly rejected: readonly string[];
}

/**
 * Push (FCM) and email (SMTP) behind one interface. Choosing the
 * recipients and the language is the notification service's job; this only delivers. Transient
 * provider failures throw `ExternalServiceError`.
 */
export interface Notifier {
  sendPush(request: PushRequest): Promise<PushResult>;
  sendEmail(request: EmailRequest): Promise<EmailResult>;
}
