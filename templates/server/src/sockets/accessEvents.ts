import { ACCESS_REVOKED_GRACE_MS, ACCOUNT_SOCKET_EVENTS, SOCKET_ROOMS } from '../constants/sockets';
import type { AccessEvents } from '../domain/access/accessEvents';
import type { Logger } from '../utils/logger';
import type { SocketRelay } from './relay';

/** Account events over Socket.IO; a socket problem can never undo the change that triggered it. */
export const createAccessEvents = (deps: {
  readonly relay: SocketRelay;
  readonly logger: Logger;
}): AccessEvents => {
  const { relay, logger } = deps;
  const roomOf = (a: { scope: 'customer' | 'merchant'; id: string }): string =>
    a.scope === 'customer' ? SOCKET_ROOMS.customer(a.id) : SOCKET_ROOMS.member(a.id);

  const safely = (what: string, task: () => void): Promise<void> => {
    try {
      task();
    } catch (error) {
      logger.error({ err: error, what }, 'account socket event failed');
    }
    return Promise.resolve();
  };

  return {
    permissionsChanged: (memberId) =>
      safely('permissionsChanged', () => {
        relay.current?.emit(
          'merchant',
          SOCKET_ROOMS.member(memberId),
          ACCOUNT_SOCKET_EVENTS.permissionsUpdated,
          {},
        );
      }),
    accessRevoked: (account) =>
      safely('accessRevoked', () => {
        const hub = relay.current;
        if (hub === undefined) return;
        hub.emit(account.scope, roomOf(account), ACCOUNT_SOCKET_EVENTS.accessRevoked, {});
        setTimeout(() => {
          hub.disconnect(account.scope, roomOf(account));
        }, ACCESS_REVOKED_GRACE_MS).unref();
      }),
    unreadChanged: (account, count) =>
      safely('unreadChanged', () => {
        relay.current?.emit(
          account.scope,
          roomOf(account),
          ACCOUNT_SOCKET_EVENTS.notificationsUnread,
          { count },
        );
      }),
  };
};
