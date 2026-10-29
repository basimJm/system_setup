import type { SocketHub } from './socketServer';

/**
 * Services are built before the HTTP server (and so before the socket hub) exists. They emit
 * through this relay; `server.ts` sets `current` once the hub is up. Tests leave it empty.
 */
export interface SocketRelay {
  current?: SocketHub;
}
