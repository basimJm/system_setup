import { SOCKET_ROOMS } from '../constants/sockets';
import type { MembersRepository } from '../repositories/identity.repository';
import type { SocketServerOptions } from './socketServer';

/**
 * Rooms of a merchant socket at connect time (docs/BUSINESS_DOMAIN.md §7): every active member
 * sits in their tenant's room. A deactivated or unknown member is refused.
 */
export const createRoomsFor =
  (members: Pick<MembersRepository, 'findById'>): NonNullable<SocketServerOptions['roomsFor']> =>
  async (scope, claims) => {
    if (scope !== 'merchant') return [];
    const member = await members.findById(claims.subjectId);
    if (member?.active !== true) return null;
    return [SOCKET_ROOMS.tenant(member.tenantId)];
  };
