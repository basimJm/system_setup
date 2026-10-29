import {
  ERROR_CODES,
  HTTP_STATUS,
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  WIRE,
} from '../../constants/payments';
import type { PaymentStatus, RefundStatus } from '../../constants/payments';
import type { FetchLike, HttpConfig, ResolvedConfig } from '../../config/options';
import { SdkError, toSdkError } from '../../errors';
import { realRetryDeps, withRetry, withTimeout, type RetryDeps } from '../../retry';
import type {
  CheckoutSession,
  CreateSessionRequest,
  PaymentGateway,
  PaymentState,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  WebhookInput,
} from '../../types';
import { assertId, assertRefundRequest, assertSessionRequest } from '../../validation';
import { verifyWebhook } from '../../webhook';

type HttpResolved = ResolvedConfig & { readonly http: HttpConfig };

export interface HttpDeps {
  readonly fetch: FetchLike;
  readonly retryDeps?: RetryDeps;
}

interface WireError {
  readonly error?: { readonly code?: string };
}

const WIRE_CODES: Record<string, string> = {
  [WIRE.errorCodes.notFound]: ERROR_CODES.SESSION_NOT_FOUND,
  [WIRE.errorCodes.idempotencyConflict]: ERROR_CODES.IDEMPOTENCY_CONFLICT,
  [WIRE.errorCodes.refundNotAllowed]: ERROR_CODES.REFUND_NOT_ALLOWED,
  [WIRE.errorCodes.unauthorized]: ERROR_CODES.AUTH_FAILED,
};

/** Every HTTP status the gateway can answer, mapped (Rules.md §3.8). */
export const mapStatus = (status: number, wireCode: string | undefined): SdkError | 'ok' => {
  if (status === HTTP_STATUS.ok || status === HTTP_STATUS.created) return 'ok';
  const fail = (code: string, message: string, retryable = false): SdkError =>
    new SdkError(code, message, { retryable, details: { status, wireCode } });
  const known = wireCode === undefined ? undefined : WIRE_CODES[wireCode];
  if (known !== undefined) return fail(known, `gateway answered ${wireCode ?? ''}`);
  if (status === HTTP_STATUS.unauthorized || status === HTTP_STATUS.forbidden)
    return fail(ERROR_CODES.AUTH_FAILED, 'gateway refused the credentials');
  if (status === HTTP_STATUS.notFound) return fail(ERROR_CODES.SESSION_NOT_FOUND, 'not found');
  if (status === HTTP_STATUS.tooManyRequests)
    return fail(ERROR_CODES.RATE_LIMITED, 'gateway is throttling', true);
  if (status >= HTTP_STATUS.serverErrorMin)
    return fail(ERROR_CODES.UNAVAILABLE, 'gateway is unavailable', true);
  if (
    status === HTTP_STATUS.badRequest ||
    status === HTTP_STATUS.unprocessable ||
    status === HTTP_STATUS.conflict
  )
    return fail(ERROR_CODES.VENDOR_ERROR, 'gateway rejected the request');
  return fail(ERROR_CODES.UNKNOWN, `unexpected gateway status ${String(status)}`);
};

const paymentStatus = (value: unknown): PaymentStatus =>
  (PAYMENT_STATUSES as readonly unknown[]).includes(value) ? (value as PaymentStatus) : 'UNKNOWN';
const refundStatus = (value: unknown): RefundStatus =>
  (REFUND_STATUSES as readonly unknown[]).includes(value) ? (value as RefundStatus) : 'UNKNOWN';
const dateOf = (value: unknown): Date | undefined => {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * Generic JSON-protocol adapter (the mock gateway on localhost today; a vendor speaking the same
 * contract, or an adapter translating it, later). Bearer auth, idempotency header, every status mapped.
 */
export class HttpGateway implements PaymentGateway {
  private readonly retryDeps: RetryDeps;

  constructor(
    private readonly config: HttpResolved,
    private readonly deps: HttpDeps,
  ) {
    this.retryDeps = deps.retryDeps ?? realRetryDeps;
  }

  async createSession(request: CreateSessionRequest): Promise<CheckoutSession> {
    assertSessionRequest(request, this.config.currencies);
    const { idempotencyKey, ...body } = request;
    const answer = await this.call('POST', WIRE.sessions, body, idempotencyKey);
    const expiresAt = dateOf(answer.expiresAt);
    if (
      typeof answer.sessionId !== 'string' ||
      typeof answer.redirectUrl !== 'string' ||
      expiresAt === undefined
    )
      throw this.malformed('session');
    return {
      sessionId: answer.sessionId,
      redirectUrl: answer.redirectUrl,
      expiresAt,
      status: this.status(paymentStatus(answer.status), answer),
    };
  }

  async verify(sessionId: string): Promise<PaymentState> {
    assertId(sessionId, 'sessionId');
    const answer = await this.call('GET', `${WIRE.sessions}/${encodeURIComponent(sessionId)}`);
    if (typeof answer.amount !== 'number' || typeof answer.currency !== 'string')
      throw this.malformed('payment');
    const paidAt = dateOf(answer.paidAt);
    return {
      sessionId,
      status: this.status(paymentStatus(answer.status), answer),
      amount: answer.amount,
      currency: answer.currency,
      ...(paidAt === undefined ? {} : { paidAt }),
      ...(typeof answer.reference === 'string' ? { reference: answer.reference } : {}),
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    assertRefundRequest(request);
    const { idempotencyKey, ...body } = request;
    const answer = await this.call('POST', WIRE.refunds, body, idempotencyKey);
    if (typeof answer.refundId !== 'string' || typeof answer.amount !== 'number')
      throw this.malformed('refund');
    const status = refundStatus(answer.status);
    if (status === 'UNKNOWN') this.config.logger.warn('unknown refund status', { answer });
    return { refundId: answer.refundId, status, amount: answer.amount };
  }

  parseWebhook(input: WebhookInput): Promise<WebhookEvent> {
    try {
      return Promise.resolve(
        verifyWebhook(
          this.config.webhookSecret,
          input,
          this.config.now(),
          this.config.webhookToleranceSec,
        ),
      );
    } catch (error) {
      return Promise.reject(toSdkError(error));
    }
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  /** Unknown vendor statuses never pass as success: logged (redacted) and surfaced as UNKNOWN. */
  private status<T extends string>(status: T, answer: Record<string, unknown>): T {
    if (status === 'UNKNOWN') this.config.logger.warn('unknown payment status', { answer });
    return status;
  }

  private malformed(what: string): SdkError {
    return new SdkError(
      ERROR_CODES.MALFORMED_RESPONSE,
      `gateway ${what} answer lacks required fields`,
    );
  }

  /** One request with timeout + retry; parses JSON; maps every status. */
  private call(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<Record<string, unknown>> {
    const url = `${this.config.http.baseUrl}${WIRE.apiPrefix}${path}`;
    const headers: Record<string, string> = {
      [WIRE.headers.authorization]: `${WIRE.bearer}${this.config.http.apiKey}`,
      [WIRE.headers.contentType]: WIRE.json,
      ...(idempotencyKey === undefined ? {} : { [WIRE.headers.idempotencyKey]: idempotencyKey }),
    };
    return withRetry(
      async () => {
        const response = await withTimeout(
          this.deps
            .fetch(url, {
              method,
              headers,
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            })
            .catch((error: unknown) => {
              throw new SdkError(ERROR_CODES.NETWORK_ERROR, 'gateway unreachable', {
                retryable: true,
                cause: error,
              });
            }),
          this.config.timeoutMs,
        );
        const text = await response.text();
        let parsed: unknown;
        try {
          parsed = text.length === 0 ? {} : JSON.parse(text);
        } catch (error) {
          throw new SdkError(ERROR_CODES.MALFORMED_RESPONSE, 'gateway answer is not JSON', {
            cause: error,
            details: { status: response.status },
          });
        }
        const record =
          typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
        const outcome = mapStatus(response.status, (record as WireError).error?.code);
        if (outcome === 'ok') return record;
        this.config.logger.warn('gateway request failed', {
          method,
          path,
          status: response.status,
        });
        throw outcome;
      },
      this.config.retry,
      this.retryDeps,
    );
  }
}
