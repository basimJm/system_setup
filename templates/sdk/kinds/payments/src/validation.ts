import { CURRENCY_PATTERN, DEFAULTS, ID_PATTERN } from './constants/payments';
import { validationError } from './errors';
import type { CreateSessionRequest, RefundRequest } from './types';

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export const assertId = (value: string, name: string): void => {
  if (!isText(value) || !ID_PATTERN.test(value))
    throw validationError(`${name} has an invalid shape`);
};

export const assertAmount = (amount: number, name = 'amount'): void => {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw validationError(`${name} must be a positive integer in minor units`);
};

export const assertCurrency = (currency: string, allowed: readonly string[]): void => {
  if (!isText(currency) || !CURRENCY_PATTERN.test(currency))
    throw validationError('currency must be an ISO 4217 code');
  if (allowed.length > 0 && !allowed.includes(currency))
    throw validationError('currency is not enabled for this system');
};

const assertUrl = (value: string | undefined, name: string, required: boolean): void => {
  if (value === undefined) {
    if (required) throw validationError(`${name} is required`);
    return;
  }
  if (!isText(value) || !URL.canParse(value)) throw validationError(`${name} must be a URL`);
};

export const assertSessionRequest = (
  request: CreateSessionRequest,
  currencies: readonly string[],
): void => {
  assertId(request.orderId, 'orderId');
  assertId(request.idempotencyKey, 'idempotencyKey');
  assertAmount(request.amount);
  assertCurrency(request.currency, currencies);
  assertId(request.customer.id, 'customer.id');
  assertUrl(request.returnUrl, 'returnUrl', true);
  assertUrl(request.cancelUrl, 'cancelUrl', false);
  if (request.metadata !== undefined) {
    const entries = Object.entries(request.metadata);
    if (
      entries.length > DEFAULTS.maxMetadataEntries ||
      entries.some(([, v]) => typeof v !== 'string')
    )
      throw validationError('metadata must be at most 20 string entries');
  }
  if (request.destinations !== undefined) {
    let total = 0;
    for (const destination of request.destinations) {
      assertId(destination.accountId, 'destinations.accountId');
      assertAmount(destination.amount, 'destinations.amount');
      total += destination.amount;
    }
    if (total > request.amount) throw validationError('destinations exceed the amount');
  }
};

export const assertRefundRequest = (request: RefundRequest): void => {
  assertId(request.sessionId, 'sessionId');
  assertId(request.idempotencyKey, 'idempotencyKey');
  if (!isText(request.reason)) throw validationError('reason is required');
  if (request.amount !== undefined) assertAmount(request.amount);
};
