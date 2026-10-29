import { randomUUID } from 'node:crypto';
import {
  FAKE_GATEWAY_CODES,
  FAKE_PAYMENT_SCENARIOS,
  FAKE_WEBHOOK_SIGNATURE,
  PAYMENT_REFERENCE_PATTERN,
  type FakePaymentScenario,
} from '../../constants/providers';
import { PaymentError, UnauthorizedError } from '../../utils/errors';
import { IdempotencyStore } from '../idempotency';
import { assertIdempotencyKey } from '../notifier/validation';
import type {
  CreateSessionRequest,
  PaymentProvider,
  PaymentSession,
  PaymentVerification,
  PaymentWebhookEvent,
  RefundRequest,
  RefundResult,
  WebhookInput,
} from './types';

interface StoredSession {
  readonly amount: number;
  readonly reference: string;
  status: PaymentSession['status'];
  refunded: number;
}

const FAKE_PROVIDER = 'fake';
const FAKE_ENVIRONMENT = 'dev';
const FAKE_BRANDS = ['VISA', 'MASTER'] as const;
const FAKE_RESULT_URL = 'fake://payment/result';

const scenarioOf = (reference: string): FakePaymentScenario => {
  const [, suffix] = reference.split('@');
  const found = FAKE_PAYMENT_SCENARIOS.find((scenario) => scenario === suffix);
  return found ?? 'success';
};

/** The JSON body the fake gateway would POST to the webhook for a session. */
export const fakeWebhookBody = (sessionId: string, status: PaymentVerification['status']): string =>
  JSON.stringify({ sessionId, status });

/**
 * In-memory gateway for dev/test (production config refuses it). The scenario is chosen by the
 * reference suffix: `order-1@fail`, `order-2@cancel`, `order-3@pending`; anything else succeeds.
 */
export class FakePaymentProvider implements PaymentProvider {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly refunds = new Map<string, RefundResult>();
  private readonly sessionKeys = new IdempotencyStore<PaymentSession>();
  private readonly refundKeys = new IdempotencyStore<RefundResult>();

  createSession(request: CreateSessionRequest): Promise<PaymentSession> {
    assertIdempotencyKey(request.idempotencyKey);
    if (!Number.isSafeInteger(request.amountFils) || request.amountFils <= 0)
      return Promise.reject(new RangeError('amount must be a positive whole number'));
    if (!PAYMENT_REFERENCE_PATTERN.test(request.reference.split('@')[0] ?? ''))
      return Promise.reject(new RangeError('invalid payment reference'));
    return this.sessionKeys.run(request.idempotencyKey, JSON.stringify(request), () => {
      const sessionId = randomUUID();
      this.sessions.set(sessionId, {
        amount: request.amountFils,
        reference: request.reference,
        status: 'PENDING',
        refunded: 0,
      });
      return Promise.resolve({
        sessionId,
        status: 'PENDING' as const,
        amountFils: request.amountFils,
        reference: request.reference,
        client: this.clientCheckout(sessionId),
      });
    });
  }

  verify(sessionId: string): Promise<PaymentVerification> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return Promise.reject(new PaymentError());
    if (session.status === 'PENDING') {
      const scenario = scenarioOf(session.reference);
      session.status =
        scenario === 'success'
          ? 'SUCCEEDED'
          : scenario === 'fail'
            ? 'FAILED'
            : scenario === 'cancel'
              ? 'CANCELLED'
              : 'PENDING';
    }
    const code =
      session.status === 'SUCCEEDED'
        ? FAKE_GATEWAY_CODES.success
        : session.status === 'FAILED'
          ? FAKE_GATEWAY_CODES.fail
          : session.status === 'CANCELLED'
            ? FAKE_GATEWAY_CODES.cancel
            : FAKE_GATEWAY_CODES.pending;
    return Promise.resolve({
      sessionId,
      status: session.status,
      amountFils: session.amount,
      gatewayCode: code,
      gatewayMessage: `fake gateway: ${session.status}`,
    });
  }

  refund(request: RefundRequest): Promise<RefundResult> {
    assertIdempotencyKey(request.idempotencyKey);
    return this.refundKeys.run(request.idempotencyKey, JSON.stringify(request), () => {
      const session = this.sessions.get(request.sessionId);
      if (session?.status !== 'SUCCEEDED') return Promise.reject(new PaymentError());
      if (
        !Number.isSafeInteger(request.amountFils) ||
        request.amountFils <= 0 ||
        session.refunded + request.amountFils > session.amount
      ) {
        return Promise.reject(new PaymentError());
      }
      session.refunded += request.amountFils;
      const result: RefundResult = {
        refundId: randomUUID(),
        sessionId: request.sessionId,
        status: 'REFUNDED',
        amountFils: request.amountFils,
        gatewayCode: FAKE_GATEWAY_CODES.success,
        gatewayMessage: 'fake gateway: refunded',
      };
      this.refunds.set(result.refundId, result);
      return Promise.resolve(result);
    });
  }

  getRefund(refundId: string): Promise<RefundResult> {
    const found = this.refunds.get(refundId);
    return found === undefined ? Promise.reject(new PaymentError()) : Promise.resolve(found);
  }

  handleWebhook(input: WebhookInput): Promise<PaymentWebhookEvent> {
    if (input.signature !== FAKE_WEBHOOK_SIGNATURE) return Promise.reject(new UnauthorizedError());
    let parsed: { sessionId?: unknown; status?: unknown };
    try {
      parsed = JSON.parse(input.rawBody) as { sessionId?: unknown; status?: unknown };
    } catch {
      return Promise.reject(new UnauthorizedError());
    }
    const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : '';
    const session = this.sessions.get(sessionId);
    if (session === undefined)
      return Promise.resolve({
        kind: 'IGNORED',
        sessionId,
        status: 'PENDING',
        gatewayCode: FAKE_GATEWAY_CODES.pending,
        gatewayMessage: 'unknown session',
      });
    const status =
      parsed.status === 'SUCCEEDED' || parsed.status === 'FAILED' || parsed.status === 'CANCELLED'
        ? parsed.status
        : 'PENDING';
    const replayed = session.status === status;
    session.status = status;
    return Promise.resolve({
      kind: 'PAYMENT',
      replayed,
      sessionId,
      status,
      gatewayCode: status === 'SUCCEEDED' ? FAKE_GATEWAY_CODES.success : FAKE_GATEWAY_CODES.fail,
      gatewayMessage: `fake gateway webhook: ${status}`,
    });
  }

  clientCheckout(sessionId: string): PaymentSession['client'] & object {
    return {
      provider: FAKE_PROVIDER,
      environment: FAKE_ENVIRONMENT,
      checkoutId: sessionId,
      brands: [...FAKE_BRANDS],
      shopperResultUrl: FAKE_RESULT_URL,
    };
  }
}
