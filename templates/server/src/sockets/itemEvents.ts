import { ITEM_SOCKET_EVENTS } from '../constants/items';
import { ADMIN_SOCKET_EVENTS, SOCKET_ROOMS } from '../constants/sockets';
import type { AdminItemView } from '../domain/items/items.service';
import type { Logger } from '../utils/logger';
import type { SocketRelay } from './relay';

export interface ItemEvents {
  created(item: AdminItemView): void;
  updated(item: AdminItemView): void;
  /** Tells open admin panels to refresh their overview. */
  overviewTick(): void;
}

/**
 * Sample feature events (docs/BUSINESS_DOMAIN.md §7): the owner's room (customer or tenant) and
 * the admin room get a small summary; clients refetch what they show. An emit never throws.
 */
export const createItemEvents = (deps: {
  readonly relay: SocketRelay;
  readonly logger: Logger;
  readonly now?: () => Date;
}): ItemEvents => {
  const now = deps.now ?? ((): Date => new Date());
  const emit = (
    scope: 'customer' | 'merchant' | 'admin',
    room: string,
    event: string,
    payload: Record<string, unknown>,
  ): void => {
    try {
      deps.relay.current?.emit(scope, room, event, payload);
    } catch (error) {
      deps.logger.error({ err: error, event }, 'socket event failed');
    }
  };
  const toOwner = (item: AdminItemView, event: string): void => {
    const payload = { id: item.id, status: item.status };
    if (item.owner.type === 'CUSTOMER')
      emit('customer', SOCKET_ROOMS.customer(item.owner.id), event, payload);
    else emit('merchant', SOCKET_ROOMS.tenant(item.owner.id), event, payload);
    emit('admin', SOCKET_ROOMS.admin, event, { ...payload, owner: item.owner });
  };
  return {
    created: (item) => {
      toOwner(item, ITEM_SOCKET_EVENTS.created);
    },
    updated: (item) => {
      toOwner(item, ITEM_SOCKET_EVENTS.updated);
    },
    overviewTick: () => {
      emit('admin', SOCKET_ROOMS.admin, ADMIN_SOCKET_EVENTS.overviewTick, {
        at: now().toISOString(),
      });
    },
  };
};
