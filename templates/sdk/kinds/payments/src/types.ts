import type { PaymentStatus, RefundStatus, WebhookEventType } from './constants/payments';

export interface Customer {
  readonly id: string;
  readonly email?: string;
  readonly phone?: string;
}

/** Phase 2 (split payments): amounts routed to sub-merchant accounts; pass-through today. */
export interface Destination {
  readonly accountId: string;
  readonly amount: number;
}

export interface CreateSessionRequest {
  /** The consumer's order / booking id; also the natural idempotency scope. */
  readonly orderId: string;
  /** Integer minor units (fils, cents). */
  readonly amount: number;
  /** ISO 4217 code. */
  readonly currency: string;
  readonly customer: Customer;
  readonly description?: string;
  readonly returnUrl: string;
  readonly cancelUrl?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly destinations?: readonly Destination[];
  /** Same key → same session; a different body under the same key is a conflict. */
  readonly idempotencyKey: string;
}

export interface CheckoutSession {
  readonly sessionId: string;
  /** Where the client completes the payment. */
  readonly redirectUrl: string;
  readonly expiresAt: Date;
  readonly status: PaymentStatus;
}

export interface PaymentState {
  readonly sessionId: string;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly currency: string;
  readonly paidAt?: Date;
  /** Gateway reference to show on receipts and reconcile. */
  readonly reference?: string;
}

export interface RefundRequest {
  readonly sessionId: string;
  /** Integer minor units; omitted = full refund. */
  readonly amount?: number;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface RefundResult {
  readonly refundId: string;
  readonly status: RefundStatus;
  readonly amount: number;
}

export interface WebhookInput {
  /** Header names are matched case-insensitively. */
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  /** The exact bytes received; never a re-serialised object. */
  readonly rawBody: string | Buffer;
}

export interface WebhookEvent {
  readonly eventId: string;
  readonly type: WebhookEventType;
  readonly sessionId: string;
  readonly occurredAt: Date;
  /** Vendor payload for logging / reconciliation; already verified. */
  readonly data: Readonly<Record<string, unknown>>;
}

/** The port: checkout session, verification, refund, webhook parsing. The consumer owns the business flow. */
export interface PaymentGateway {
  createSession(request: CreateSessionRequest): Promise<CheckoutSession>;
  /** Server-side truth; the consumer verifies before fulfilling (never trusts the redirect). */
  verify(sessionId: string): Promise<PaymentState>;
  refund(request: RefundRequest): Promise<RefundResult>;
  /** Verifies the signature and timestamp; rejects with `WEBHOOK_INVALID` / `AUTH_FAILED`. */
  parseWebhook(input: WebhookInput): Promise<WebhookEvent>;
  close(): Promise<void>;
}
