import type { PaymentStatus, RefundStatus } from '../../constants/providers';

export interface CreateSessionRequest {
  /** One checkout = one key; repeating it returns the same session. */
  readonly idempotencyKey: string;
  /** Integer minor units, greater than zero. */
  readonly amountFils: number;
  /** Our own reference for the attempt (e.g. the order id). */
  readonly reference: string;
}

/** What the app needs to open the gateway's payment UI (no secrets). */
export interface PaymentClientCheckout {
  readonly provider: string;
  readonly environment: 'dev' | 'prod';
  readonly checkoutId: string;
  readonly brands: readonly string[];
  readonly shopperResultUrl: string;
  /** Hosted pay page (the local mock gateway only). */
  readonly checkoutUrl?: string;
  readonly widgetScriptUrl?: string;
  readonly integrity?: string;
}

export interface PaymentSession {
  readonly sessionId: string;
  readonly status: PaymentStatus;
  readonly amountFils: number;
  readonly reference: string;
  readonly client?: PaymentClientCheckout;
}

/** The gateway's answer, normalized, with its raw code kept for the admin attempt log. */
export interface PaymentVerification {
  readonly sessionId: string;
  readonly status: PaymentStatus;
  readonly amountFils: number;
  readonly gatewayCode: string;
  readonly gatewayMessage: string;
  /** Gateway fee in minor units when the gateway reports one. */
  readonly feeFils?: number;
}

export interface RefundRequest {
  readonly idempotencyKey: string;
  readonly sessionId: string;
  /** Integer minor units; partial refunds add up to at most the captured amount. */
  readonly amountFils: number;
}

export interface RefundResult {
  readonly refundId: string;
  readonly sessionId: string;
  readonly status: RefundStatus;
  readonly amountFils: number;
  readonly gatewayCode: string;
  readonly gatewayMessage: string;
}

export interface WebhookInput {
  /** The body exactly as received: the signature covers it. */
  readonly rawBody: string;
  readonly signature: string;
  /** Request headers (lower-case names): some gateways need more than the signature. */
  readonly headers?: Readonly<Record<string, string | undefined>>;
}

export interface PaymentWebhookEvent {
  /** Absent = a payment notification. `REFUND` / `IGNORED` never settle a payment. */
  readonly kind?: 'PAYMENT' | 'REFUND' | 'IGNORED';
  /** True when this exact notification was already handled. */
  readonly replayed?: boolean;
  readonly sessionId: string;
  readonly status: PaymentStatus;
  readonly gatewayCode: string;
  readonly gatewayMessage: string;
}

/**
 * One gateway behind one interface. Money is integer minor units. A declined
 * payment is a normal result (`status: FAILED`); an unverifiable webhook throws
 * `UnauthorizedError`; refunding more than was captured throws `PaymentError`; a gateway outage
 * throws `ExternalServiceError`. The server must call `verify` before trusting a payment.
 */
export interface PaymentProvider {
  createSession(request: CreateSessionRequest): Promise<PaymentSession>;
  verify(sessionId: string): Promise<PaymentVerification>;
  refund(request: RefundRequest): Promise<RefundResult>;
  getRefund(refundId: string): Promise<RefundResult>;
  /** Authenticates the webhook, then maps it to a normalized event. */
  handleWebhook(input: WebhookInput): Promise<PaymentWebhookEvent>;
  /** Rebuilds the app's checkout data for an existing session (resumed attempts). */
  clientCheckout?(sessionId: string): PaymentClientCheckout;
}
