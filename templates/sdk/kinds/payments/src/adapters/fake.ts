import type { SettleStatus } from '../constants/payments';
import { ERROR_CODES } from '../constants/payments';
import type { ResolvedConfig } from '../config/options';
import { SdkError } from '../errors';
import { requestHash } from '../hash';
import { Ledger, type LedgerError, type SignedWebhook } from '../mock/ledger';
import type {
  CheckoutSession,
  CreateSessionRequest,
  PaymentGateway,
  PaymentState,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  WebhookInput,
} from '../types';
import { assertId, assertRefundRequest, assertSessionRequest } from '../validation';
import { verifyWebhook } from '../webhook';

const FAKE_CHECKOUT_URL = 'http://localhost/checkout';

export const ledgerError = (error: LedgerError): SdkError => {
  switch (error) {
    case 'NOT_FOUND':
      return new SdkError(ERROR_CODES.SESSION_NOT_FOUND, 'session not found');
    case 'IDEMPOTENCY_CONFLICT':
      return new SdkError(
        ERROR_CODES.IDEMPOTENCY_CONFLICT,
        'idempotency key reused with another request',
      );
    case 'REFUND_NOT_ALLOWED':
      return new SdkError(
        ERROR_CODES.REFUND_NOT_ALLOWED,
        'session is not refundable for this amount',
      );
    case 'INVALID':
      return new SdkError(ERROR_CODES.VENDOR_ERROR, 'session is not pending');
  }
};

/**
 * In-process gateway for tests and offline dev: sessions settle through `settle()`, which also
 * returns the signed webhook a real gateway would POST. Refused in production.
 */
export class FakeGateway implements PaymentGateway {
  readonly ledger: Ledger;
  /** Set to make the next calls fail with this error until cleared. */
  failWith: Error | undefined;

  constructor(
    private readonly config: ResolvedConfig,
    ledger?: Ledger,
  ) {
    this.ledger =
      ledger ??
      new Ledger({
        webhookSecret: config.webhookSecret,
        sessionTtlSec: config.sessionTtlSec,
        checkoutUrl: config.http?.checkoutUrl ?? FAKE_CHECKOUT_URL,
        now: config.now,
      });
  }

  private guard<T>(work: () => T): Promise<T> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    try {
      return Promise.resolve(work());
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  createSession(request: CreateSessionRequest): Promise<CheckoutSession> {
    return this.guard(() => {
      assertSessionRequest(request, this.config.currencies);
      const { idempotencyKey, ...body } = request;
      const result = this.ledger.createSession(idempotencyKey, requestHash(body), body);
      if (typeof result === 'string') throw ledgerError(result);
      const { session } = result;
      return {
        sessionId: session.sessionId,
        redirectUrl: session.redirectUrl,
        expiresAt: session.expiresAt,
        status: session.status,
      };
    });
  }

  verify(sessionId: string): Promise<PaymentState> {
    return this.guard(() => {
      assertId(sessionId, 'sessionId');
      const session = this.ledger.getSession(sessionId);
      if (session === undefined) throw ledgerError('NOT_FOUND');
      return {
        sessionId,
        status: session.status,
        amount: session.amount,
        currency: session.currency,
        ...(session.paidAt === undefined ? {} : { paidAt: session.paidAt }),
        ...(session.reference === undefined ? {} : { reference: session.reference }),
      };
    });
  }

  refund(request: RefundRequest): Promise<RefundResult> {
    return this.guard(() => {
      assertRefundRequest(request);
      const { idempotencyKey, ...body } = request;
      const result = this.ledger.refund(idempotencyKey, requestHash(body), body);
      if (typeof result === 'string') throw ledgerError(result);
      return {
        refundId: result.refund.refundId,
        status: result.refund.status,
        amount: result.refund.amount,
      };
    });
  }

  parseWebhook(input: WebhookInput): Promise<WebhookEvent> {
    return this.guard(() =>
      verifyWebhook(
        this.config.webhookSecret,
        input,
        this.config.now(),
        this.config.webhookToleranceSec,
      ),
    );
  }

  /** Test helper: the payer finished; returns the signed webhook to feed into `parseWebhook`. */
  settle(sessionId: string, status: SettleStatus): SignedWebhook {
    const result = this.ledger.settle(sessionId, status);
    if (typeof result === 'string') throw ledgerError(result);
    return result;
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
