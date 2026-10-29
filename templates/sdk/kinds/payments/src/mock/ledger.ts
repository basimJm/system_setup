import { randomBytes } from 'node:crypto';
import { MS_PER_SECOND } from '../constants/defaults';
import {
  type PaymentStatus,
  type RefundStatus,
  type SettleStatus,
  type WebhookEventType,
} from '../constants/payments';
import { signWebhook, type WebhookBody } from '../webhook';

export interface LedgerSession {
  readonly sessionId: string;
  readonly orderId: string;
  readonly amount: number;
  readonly currency: string;
  readonly redirectUrl: string;
  readonly expiresAt: Date;
  readonly requestHash: string;
  status: PaymentStatus;
  paidAt?: Date;
  reference?: string;
  refunded: number;
}

export interface LedgerRefund {
  readonly refundId: string;
  readonly sessionId: string;
  readonly amount: number;
  readonly status: RefundStatus;
  readonly requestHash: string;
}

export interface SignedWebhook {
  readonly headers: Record<string, string>;
  readonly body: string;
}

export type LedgerError = 'NOT_FOUND' | 'IDEMPOTENCY_CONFLICT' | 'REFUND_NOT_ALLOWED' | 'INVALID';

export interface LedgerOptions {
  readonly webhookSecret: string;
  readonly sessionTtlSec: number;
  readonly checkoutUrl: string;
  readonly now: () => Date;
  readonly idGenerator?: (prefix: string) => string;
}

const SETTLE_EVENTS: Record<SettleStatus, WebhookEventType> = {
  PAID: 'PAYMENT_PAID',
  FAILED: 'PAYMENT_FAILED',
  EXPIRED: 'PAYMENT_EXPIRED',
};
const ID_BYTES = 8;

export const randomId = (prefix: string): string =>
  `${prefix}_${randomBytes(ID_BYTES).toString('hex')}`;

/**
 * The gateway's memory, shared by the fake adapter (in process) and the mock gateway (HTTP):
 * sessions, refunds, idempotency by key + request hash, and signed webhooks on settlement.
 */
export class Ledger {
  private readonly sessions = new Map<string, LedgerSession>();
  private readonly sessionKeys = new Map<string, string>();
  private readonly refunds = new Map<string, LedgerRefund>();
  private readonly refundKeys = new Map<string, string>();
  private readonly id: (prefix: string) => string;

  constructor(private readonly options: LedgerOptions) {
    this.id = options.idGenerator ?? randomId;
  }

  createSession(
    idempotencyKey: string,
    requestHash: string,
    input: { orderId: string; amount: number; currency: string },
  ): { session: LedgerSession; created: boolean } | LedgerError {
    const existingId = this.sessionKeys.get(idempotencyKey);
    if (existingId !== undefined) {
      const existing = this.sessions.get(existingId);
      /* istanbul ignore next -- keys and sessions are written together */
      if (existing === undefined) return 'NOT_FOUND';
      return existing.requestHash === requestHash
        ? { session: existing, created: false }
        : 'IDEMPOTENCY_CONFLICT';
    }
    const sessionId = this.id('sess');
    const session: LedgerSession = {
      sessionId,
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      redirectUrl: `${this.options.checkoutUrl}/${sessionId}`,
      expiresAt: new Date(
        this.options.now().getTime() + this.options.sessionTtlSec * MS_PER_SECOND,
      ),
      requestHash,
      status: 'PENDING',
      refunded: 0,
    };
    this.sessions.set(sessionId, session);
    this.sessionKeys.set(idempotencyKey, sessionId);
    return { session, created: true };
  }

  /** Reads a session, expiring it lazily when its TTL passed while pending. */
  getSession(sessionId: string): LedgerSession | undefined {
    const session = this.sessions.get(sessionId);
    if (
      session?.status === 'PENDING' &&
      session.expiresAt.getTime() <= this.options.now().getTime()
    )
      session.status = 'EXPIRED';
    return session;
  }

  /** Moves a pending session to a final status and returns the signed webhook for it. */
  settle(sessionId: string, status: SettleStatus): SignedWebhook | LedgerError {
    const session = this.getSession(sessionId);
    if (session === undefined) return 'NOT_FOUND';
    if (session.status !== 'PENDING') return 'INVALID';
    session.status = status;
    if (status === 'PAID') {
      session.paidAt = this.options.now();
      session.reference = this.id('ref');
    }
    return this.webhook(SETTLE_EVENTS[status], sessionId, { status, reference: session.reference });
  }

  refund(
    idempotencyKey: string,
    requestHash: string,
    input: { sessionId: string; amount?: number | undefined },
  ): { refund: LedgerRefund; created: boolean; webhook?: SignedWebhook } | LedgerError {
    const existingId = this.refundKeys.get(idempotencyKey);
    if (existingId !== undefined) {
      const existing = this.refunds.get(existingId);
      /* istanbul ignore next -- keys and refunds are written together */
      if (existing === undefined) return 'NOT_FOUND';
      return existing.requestHash === requestHash
        ? { refund: existing, created: false }
        : 'IDEMPOTENCY_CONFLICT';
    }
    const session = this.getSession(input.sessionId);
    if (session === undefined) return 'NOT_FOUND';
    const amount = input.amount ?? session.amount - session.refunded;
    if (
      (session.status !== 'PAID' && session.status !== 'REFUNDED') ||
      amount <= 0 ||
      session.refunded + amount > session.amount
    )
      return 'REFUND_NOT_ALLOWED';
    session.refunded += amount;
    if (session.refunded === session.amount) session.status = 'REFUNDED';
    const refund: LedgerRefund = {
      refundId: this.id('rf'),
      sessionId: session.sessionId,
      amount,
      status: 'REFUNDED',
      requestHash,
    };
    this.refunds.set(refund.refundId, refund);
    this.refundKeys.set(idempotencyKey, refund.refundId);
    return {
      refund,
      created: true,
      webhook: this.webhook('REFUND_COMPLETED', session.sessionId, {
        refundId: refund.refundId,
        amount,
      }),
    };
  }

  webhook(type: WebhookEventType, sessionId: string, data: Record<string, unknown>): SignedWebhook {
    const now = this.options.now();
    const payload: WebhookBody = {
      eventId: this.id('evt'),
      type,
      sessionId,
      occurredAt: now.toISOString(),
      data,
    };
    const body = JSON.stringify(payload);
    return { headers: signWebhook(this.options.webhookSecret, body, now), body };
  }

  get size(): number {
    return this.sessions.size;
  }

  /** Test helper: forgets everything. */
  clear(): void {
    this.sessions.clear();
    this.sessionKeys.clear();
    this.refunds.clear();
    this.refundKeys.clear();
  }
}
