import type { TokenScope } from './auth';

/** Real-time layer (docs/BUSINESS_DOMAIN.md §7): one Socket.IO namespace per token scope. */
export const SOCKET_PATH = '/socket.io';
export const SOCKET_NAMESPACES: Record<TokenScope, string> = {
  customer: '/customer',
  merchant: '/merchant',
  admin: '/admin',
};
/** Where a client puts its access token: `io(url + ns, { auth: { token } })`. */
export const SOCKET_AUTH_FIELD = 'token';
export const SOCKET_ERRORS = {
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  unavailable: 'UNAVAILABLE',
} as const;
export const SOCKET_ROOMS = {
  customer: (id: string): string => `customer:${id}`,
  member: (id: string): string => `member:${id}`,
  /** Every active member of one merchant account. */
  tenant: (tenantId: string): string => `tenant:${tenantId}`,
  admin: 'admin',
} as const;
/** Redis channel prefix of the Socket.IO adapter (keeps its pub/sub apart from other keys). */
export const SOCKET_ADAPTER_KEY = 'socket.io';
export const SOCKET_PING_INTERVAL_MS = 25_000;
export const SOCKET_PING_TIMEOUT_MS = 20_000;
export const SOCKET_MAX_PAYLOAD_BYTES = 100_000;

/** Admin room events; the panel refreshes the matching queries. */
export const ADMIN_SOCKET_EVENTS = { overviewTick: 'overview.tick' } as const;

/** Account events. */
export const ACCOUNT_SOCKET_EVENTS = {
  permissionsUpdated: 'permissions.updated',
  accessRevoked: 'access.revoked',
  notificationsUnread: 'notifications.unread',
} as const;
/** Gives the `access.revoked` message time to reach the client before its connection is closed. */
export const ACCESS_REVOKED_GRACE_MS = 250;
/** How long closing waits for the adapter's subscriber to finish connecting and subscribing. */
export const SOCKET_ADAPTER_READY_TIMEOUT_MS = 2_000;
