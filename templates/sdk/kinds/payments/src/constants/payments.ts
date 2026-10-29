import { KERNEL_ERROR_CODES } from './codes';

export const ERROR_CODES = {
  ...KERNEL_ERROR_CODES,
  SESSION_NOT_FOUND: '__SDK_PREFIX___SESSION_NOT_FOUND',
  IDEMPOTENCY_CONFLICT: '__SDK_PREFIX___IDEMPOTENCY_CONFLICT',
  REFUND_NOT_ALLOWED: '__SDK_PREFIX___REFUND_NOT_ALLOWED',
  WEBHOOK_INVALID: '__SDK_PREFIX___WEBHOOK_INVALID',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** `fake` = in-process gateway; `http` = the generic JSON protocol (mock gateway today, a vendor adapter later). */
export const PROVIDERS = ['fake', 'http'] as const;
export type ProviderName = (typeof PROVIDERS)[number];
export const DEV_ONLY_PROVIDERS: readonly ProviderName[] = ['fake'];

export const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'UNKNOWN',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
/** Statuses a mock / fake can be moved to. */
export const SETTLE_STATUSES = ['PAID', 'FAILED', 'EXPIRED'] as const;
export type SettleStatus = (typeof SETTLE_STATUSES)[number];

export const REFUND_STATUSES = ['REFUNDED', 'PENDING', 'FAILED', 'UNKNOWN'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const WEBHOOK_EVENTS = [
  'PAYMENT_PAID',
  'PAYMENT_FAILED',
  'PAYMENT_EXPIRED',
  'REFUND_COMPLETED',
  'REFUND_FAILED',
  'UNKNOWN',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export const DEFAULTS = {
  sessionTtlSec: 1_800,
  webhookToleranceSec: 300,
  maxMetadataEntries: 20,
} as const;
export const MIN_SECRET_LENGTH = 16;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

/** The generic JSON protocol spoken by the http adapter and the mock gateway. */
export const WIRE = {
  apiPrefix: '/v1',
  sessions: '/sessions',
  refunds: '/refunds',
  settleSuffix: '/settle',
  headers: {
    authorization: 'authorization',
    idempotencyKey: 'idempotency-key',
    contentType: 'content-type',
    signature: 'x-signature',
  },
  bearer: 'Bearer ',
  json: 'application/json',
  signatureTimestamp: 't',
  signatureVersion: 'v1',
  signatureSeparator: ',',
  signaturePayloadSeparator: '.',
  /** Error codes the protocol answers in `{ error: { code } }`. */
  errorCodes: {
    unauthorized: 'UNAUTHORIZED',
    notFound: 'NOT_FOUND',
    idempotencyConflict: 'IDEMPOTENCY_CONFLICT',
    refundNotAllowed: 'REFUND_NOT_ALLOWED',
    invalid: 'INVALID_REQUEST',
    rateLimited: 'RATE_LIMITED',
  },
} as const;

export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  tooManyRequests: 429,
  serverErrorMin: 500,
} as const;
