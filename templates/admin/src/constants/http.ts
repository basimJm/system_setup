export const HTTP_STATUS = {
  ok: 200,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  payloadTooLarge: 413,
  unprocessable: 422,
  rateLimited: 429,
  serverError: 500,
  badGateway: 502,
  unavailable: 503,
  gatewayTimeout: 504,
} as const;

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const HTTP_HEADERS = {
  authorization: 'Authorization',
  contentType: 'Content-Type',
  requestId: 'X-Request-Id',
  idempotencyKey: 'Idempotency-Key',
} as const;

export const BEARER_PREFIX = 'Bearer';
export const JSON_CONTENT_TYPE = 'application/json';
export const ADMIN_API_PREFIX = '/admin/v1';

export const HTTP_TIMEOUT_MS = 15_000;
export const HTTP_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 3_000,
  retryableStatuses: [502, 503, 504],
} as const;
