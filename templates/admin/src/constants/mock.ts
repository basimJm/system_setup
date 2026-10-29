import { HTTP_STATUS } from './http';

/** Behaviours the mock transport can be switched to (dev builds only). */
export const MOCK_SCENARIOS = [
  'success',
  'empty',
  'validation',
  'unauthorized',
  'forbidden',
  'notFound',
  'conflict',
  'unprocessable',
  'serverError',
  'timeout',
  'slow',
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];
export const DEFAULT_MOCK_SCENARIO: MockScenario = 'success';

/** Latency added to every answer so loading states are visible; `slow` makes it long. */
export const MOCK_LATENCY_MS = 120;
export const MOCK_SLOW_LATENCY_MS = 4_000;

/** Error scenarios: HTTP status and the server error code the panel already knows (BUSINESS_DOMAIN §11). */
export const MOCK_ERROR_SCENARIOS = {
  validation: { status: HTTP_STATUS.badRequest, code: 'VALIDATION_ERROR' },
  unauthorized: { status: HTTP_STATUS.unauthorized, code: 'UNAUTHORIZED' },
  forbidden: { status: HTTP_STATUS.forbidden, code: 'FORBIDDEN' },
  notFound: { status: HTTP_STATUS.notFound, code: 'NOT_FOUND' },
  conflict: { status: HTTP_STATUS.conflict, code: 'CONFLICT' },
  unprocessable: { status: HTTP_STATUS.unprocessable, code: 'BUSINESS_RULE' },
  serverError: { status: HTTP_STATUS.serverError, code: 'INTERNAL' },
} as const satisfies Partial<Record<MockScenario, { status: number; code: string }>>;

/** Field reported by the `validation` scenario so forms show a per-field error. */
export const MOCK_VALIDATION_FIELD = 'body.name';
export const MOCK_TRACE_PREFIX = 'mock-';
export const MOCK_ACCEPT_LANGUAGE_HEADER = 'Accept-Language';

/** Mock data source only: where fake uploaded files appear to live. */
export const MOCK_CDN_BASE = 'https://cdn.example';
