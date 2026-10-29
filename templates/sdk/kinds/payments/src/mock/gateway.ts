import { HTTP_STATUS, SETTLE_STATUSES, WIRE, type SettleStatus } from '../constants/payments';
import { requestHash } from '../hash';
import { Ledger, type LedgerError, type LedgerOptions } from './ledger';

export interface MockRequest {
  readonly method: string;
  /** Path + query, as `IncomingMessage.url`. */
  readonly url: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: string;
}

export interface MockResponse {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

export interface MockGatewayOptions extends LedgerOptions {
  readonly apiKey: string;
  /** Dev convenience: new sessions settle to this status at once (no manual settle step). */
  readonly autoSettle?: SettleStatus;
}

const LEDGER_STATUS: Record<LedgerError, { status: number; code: string }> = {
  NOT_FOUND: { status: HTTP_STATUS.notFound, code: WIRE.errorCodes.notFound },
  IDEMPOTENCY_CONFLICT: { status: HTTP_STATUS.conflict, code: WIRE.errorCodes.idempotencyConflict },
  REFUND_NOT_ALLOWED: { status: HTTP_STATUS.conflict, code: WIRE.errorCodes.refundNotAllowed },
  INVALID: { status: HTTP_STATUS.unprocessable, code: WIRE.errorCodes.invalid },
};

const fail = (status: number, code: string): MockResponse => ({
  status,
  body: { error: { code } },
});
const ledgerFail = (error: LedgerError): MockResponse =>
  fail(LEDGER_STATUS[error].status, LEDGER_STATUS[error].code);

const header = (request: MockRequest, name: string): string | undefined => {
  const entry = Object.entries(request.headers).find(([key]) => key.toLowerCase() === name);
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] : value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The mock gateway's logic, transport-free: `handle()` answers the generic JSON protocol the
 * `http` adapter speaks. `server.ts` wraps it in node:http for a dev stack on localhost.
 */
export class MockGateway {
  readonly ledger: Ledger;
  /** Status codes to answer (one per request) before normal handling resumes: outage drills. */
  readonly nextStatus: number[] = [];

  constructor(private readonly options: MockGatewayOptions) {
    this.ledger = new Ledger(options);
  }

  handle(request: MockRequest): MockResponse {
    const forced = this.nextStatus.shift();
    if (forced !== undefined) return fail(forced, WIRE.errorCodes.rateLimited);
    if (header(request, WIRE.headers.authorization) !== `${WIRE.bearer}${this.options.apiKey}`)
      return fail(HTTP_STATUS.unauthorized, WIRE.errorCodes.unauthorized);
    const path = request.url.split('?')[0] ?? '';
    const sessionsPath = `${WIRE.apiPrefix}${WIRE.sessions}`;
    const refundsPath = `${WIRE.apiPrefix}${WIRE.refunds}`;
    if (request.method === 'POST' && path === sessionsPath) return this.createSession(request);
    if (request.method === 'POST' && path === refundsPath) return this.refund(request);
    const sessionMatch = new RegExp(`^${sessionsPath}/([^/]+)(${WIRE.settleSuffix})?$`).exec(path);
    const sessionId = sessionMatch?.[1];
    if (sessionId !== undefined && request.method === 'GET' && sessionMatch?.[2] === undefined)
      return this.getSession(sessionId);
    if (sessionId !== undefined && request.method === 'POST' && sessionMatch?.[2] !== undefined)
      return this.settle(sessionId, request);
    return fail(HTTP_STATUS.notFound, WIRE.errorCodes.notFound);
  }

  private parse(request: MockRequest): Record<string, unknown> | undefined {
    try {
      const parsed: unknown = JSON.parse(request.body);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  private createSession(request: MockRequest): MockResponse {
    const key = header(request, WIRE.headers.idempotencyKey);
    const body = this.parse(request);
    if (key === undefined || body === undefined)
      return fail(HTTP_STATUS.badRequest, WIRE.errorCodes.invalid);
    const { orderId, amount, currency } = body;
    if (typeof orderId !== 'string' || typeof amount !== 'number' || typeof currency !== 'string')
      return fail(HTTP_STATUS.unprocessable, WIRE.errorCodes.invalid);
    const result = this.ledger.createSession(key, requestHash(body), { orderId, amount, currency });
    if (typeof result === 'string') return ledgerFail(result);
    if (result.created && this.options.autoSettle !== undefined)
      this.ledger.settle(result.session.sessionId, this.options.autoSettle);
    const { session } = result;
    return {
      status: result.created ? HTTP_STATUS.created : HTTP_STATUS.ok,
      body: {
        sessionId: session.sessionId,
        redirectUrl: session.redirectUrl,
        expiresAt: session.expiresAt.toISOString(),
        status: this.ledger.getSession(session.sessionId)?.status,
      },
    };
  }

  private getSession(sessionId: string): MockResponse {
    const session = this.ledger.getSession(sessionId);
    if (session === undefined) return ledgerFail('NOT_FOUND');
    return {
      status: HTTP_STATUS.ok,
      body: {
        sessionId,
        status: session.status,
        amount: session.amount,
        currency: session.currency,
        paidAt: session.paidAt?.toISOString(),
        reference: session.reference,
      },
    };
  }

  private refund(request: MockRequest): MockResponse {
    const key = header(request, WIRE.headers.idempotencyKey);
    const body = this.parse(request);
    if (key === undefined || body === undefined)
      return fail(HTTP_STATUS.badRequest, WIRE.errorCodes.invalid);
    const { sessionId, amount } = body;
    if (typeof sessionId !== 'string' || (amount !== undefined && typeof amount !== 'number'))
      return fail(HTTP_STATUS.unprocessable, WIRE.errorCodes.invalid);
    const result = this.ledger.refund(key, requestHash(body), { sessionId, amount });
    if (typeof result === 'string') return ledgerFail(result);
    return {
      status: result.created ? HTTP_STATUS.created : HTTP_STATUS.ok,
      body: {
        refundId: result.refund.refundId,
        status: result.refund.status,
        amount: result.refund.amount,
      },
    };
  }

  /** Dev control endpoint: `POST /v1/sessions/:id/settle { status }` → the signed webhook to deliver. */
  private settle(sessionId: string, request: MockRequest): MockResponse {
    const body = this.parse(request);
    const status = body?.status;
    if (typeof status !== 'string' || !(SETTLE_STATUSES as readonly string[]).includes(status))
      return fail(HTTP_STATUS.unprocessable, WIRE.errorCodes.invalid);
    const result = this.ledger.settle(sessionId, status as SettleStatus);
    if (typeof result === 'string') return ledgerFail(result);
    return { status: HTTP_STATUS.ok, body: { webhook: result } };
  }
}
