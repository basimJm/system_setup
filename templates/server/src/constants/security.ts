/** Security middleware constants. Tunable business limits live in settings. */
export const CORS_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
export const CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept-Language',
  'X-Request-Id',
  'X-App-Version',
] as const;
export const CORS_EXPOSED_HEADERS = ['X-Request-Id'] as const;
export const CORS_MAX_AGE_SEC = 600;

/** Global per-IP request budget. Stricter limits (OTP, login, uploads) use `createRateLimiter`. */
export const GLOBAL_RATE_LIMIT = { windowMs: 60_000, max: 300 } as const;
export const RATE_LIMIT_HEADER_DRAFT = 'draft-7';

/**
 * Per-route limit families. Each family counts in its own store (`rate:http:<ns>:<family>`), so
 * browsing never spends the strict OTP budget; routes of one family in one namespace share it.
 */
export const ROUTE_LIMIT_FAMILIES = {
  otp: 'otp',
  browse: 'browse',
  write: 'write',
  upload: 'upload',
} as const;
export type RouteLimitFamily = (typeof ROUTE_LIMIT_FAMILIES)[keyof typeof ROUTE_LIMIT_FAMILIES];
export const ROUTE_LIMIT_NAMESPACES = ['customer', 'merchant', 'admin'] as const;
export type RouteLimitNamespace = (typeof ROUTE_LIMIT_NAMESPACES)[number];
/** Read-mostly routes (profile, inbox, item lists). */
export const BROWSE_ROUTE_RATE_LIMIT = { windowMs: 60_000, max: 120 } as const;
/** Writes (create / update / archive). */
export const WRITE_ROUTE_RATE_LIMIT = { windowMs: 60_000, max: 60 } as const;

/** Keys that could be used for NoSQL operator injection or prototype pollution are dropped. */
export const FORBIDDEN_KEY_PREFIX = '$';
export const FORBIDDEN_KEY_CHARACTER = '.';
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
export const MAX_SANITIZE_DEPTH = 20;

export const SCRIPT_OR_STYLE_BLOCK = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
export const HTML_COMMENT = /<!--[\s\S]*?-->/g;
export const HTML_TAG = /<\/?[a-zA-Z!][^>]*>/g;
/** Stripping repeats until stable so `<scr<script>ipt>` cannot rebuild a tag. */
export const MAX_STRIP_PASSES = 5;

export const TRUST_PROXY_HOPS_MIN = 0;
export const TRUST_PROXY_HOPS_MAX = 10;
export const DEFAULT_TRUST_PROXY_HOPS = 0;
