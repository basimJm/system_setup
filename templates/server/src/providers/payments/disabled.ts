import { PAYMENTS_DISABLED_MESSAGE } from '../../constants/providers';
import { ExternalServiceError, UnauthorizedError } from '../../utils/errors';
import type {
  PaymentProvider,
  PaymentSession,
  PaymentVerification,
  PaymentWebhookEvent,
  RefundResult,
} from './types';

const unavailable = (): ExternalServiceError =>
  new ExternalServiceError({ cause: new Error(PAYMENTS_DISABLED_MESSAGE), unavailable: true });

/**
 * Payments are paused (owner decision 2026-10-19): no gateway is integrated. Every gateway call
 * answers 503 so no checkout or transaction is created, and webhooks are never trusted.
 */
export class DisabledPaymentProvider implements PaymentProvider {
  createSession(): Promise<PaymentSession> {
    return Promise.reject(unavailable());
  }

  verify(): Promise<PaymentVerification> {
    return Promise.reject(unavailable());
  }

  refund(): Promise<RefundResult> {
    return Promise.reject(unavailable());
  }

  getRefund(): Promise<RefundResult> {
    return Promise.reject(unavailable());
  }

  handleWebhook(): Promise<PaymentWebhookEvent> {
    return Promise.reject(new UnauthorizedError());
  }
}
