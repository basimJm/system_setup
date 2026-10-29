import { KERNEL_ERROR_CODES } from './codes';

export const ERROR_CODES = {
  ...KERNEL_ERROR_CODES,
  SINK_FAILED: '__SDK_PREFIX___SINK_FAILED',
  QUEUE_FULL: '__SDK_PREFIX___QUEUE_FULL',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** `fake` / `memory` keep events in process; `http` posts batches to a generic collector endpoint. */
export const PROVIDERS = ['fake', 'memory', 'http'] as const;
export type ProviderName = (typeof PROVIDERS)[number];
export const DEV_ONLY_PROVIDERS: readonly ProviderName[] = ['fake', 'memory'];

export const ENVELOPE_TYPES = ['track', 'identity'] as const;
export type EnvelopeType = (typeof ENVELOPE_TYPES)[number];

export const DEFAULTS = {
  batchSize: 50,
  flushIntervalMs: 5_000,
  maxQueue: 10_000,
  maxPropertiesBytes: 8_000,
} as const;
export const MAX_BATCH_SIZE = 500;

export const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
export const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

export const HTTP = {
  method: 'POST',
  headers: { authorization: 'Authorization', contentType: 'Content-Type' },
  bearer: 'Bearer ',
  json: 'application/json',
} as const;

export const HTTP_STATUS = {
  okMin: 200,
  okMax: 299,
  unauthorized: 401,
  forbidden: 403,
  tooManyRequests: 429,
  serverErrorMin: 500,
} as const;
