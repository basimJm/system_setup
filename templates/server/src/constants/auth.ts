/** Access-token and authentication constants. */
export const TOKEN_ISSUER = '__SYSTEM_SLUG__-server';
export const TOKEN_ALGORITHM = 'HS256';
/** HS256 needs a key at least as long as its 256-bit hash. */
export const JWT_SECRET_MIN_LENGTH = 32;

/** One scope per API namespace; a token is valid for exactly one (the JWT `aud`). */
export const TOKEN_SCOPES = ['customer', 'merchant', 'admin'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** Which account type signs in to which namespace. */
export const SCOPE_BY_SUBJECT = {
  CUSTOMER: 'customer',
  MEMBER: 'merchant',
  ADMIN: 'admin',
} as const;

export const AUTHORIZATION_HEADER = 'authorization';
export const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/** Refresh tokens: 256 random bits, base64url, so always 43 characters. */
export const REFRESH_TOKEN_BYTES = 32;
export const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const REFRESH_FAMILY_BYTES = 16;
export const TOKEN_HASH_ALGORITHM = 'sha256';

export const REVOKE_REASONS = {
  rotated: 'ROTATED',
  logout: 'LOGOUT',
  logoutAll: 'LOGOUT_ALL',
  reuseDetected: 'REUSE_DETECTED',
  accountBlocked: 'ACCOUNT_BLOCKED',
  credentialsChanged: 'CREDENTIALS_CHANGED',
  memberDeactivated: 'MEMBER_DEACTIVATED',
} as const;
