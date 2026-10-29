/** Liveness/readiness endpoints. Mounted at the root, outside the client namespaces. */
export const HEALTH_PATHS = {
  live: '/health',
  ready: '/ready',
} as const;

export const HEALTH_STATUS = {
  ok: 'ok',
  up: 'up',
  down: 'down',
} as const;

/** A dependency that does not answer within this time counts as down. */
export const READINESS_CHECK_TIMEOUT_MS = 2_000;

export const HEALTH_DETAIL_CODE_DOWN = 'DEPENDENCY_DOWN';
