import type { Permission } from '../../constants/enums';
import { ERROR_CODES } from '../../constants/errorCodes';
import type { Language } from '../../constants/i18n';
import type { MembersRepository } from '../../repositories/identity.repository';
import { isDuplicateKeyError } from '../../utils/database/errors';
import { toObjectId } from '../../utils/database/ids';
import { ConflictError, NotFoundError } from '../../utils/errors';
import type { AccessEvents } from '../access/accessEvents';
import { toMemberProfile, type MemberProfile } from '../auth/merchantAuth.service';
import { normalizeGrant } from '../permissions/permissions';
import type { RefreshTokenService } from '../auth/refreshTokens.service';

export interface TeamService {
  list(tenantId: string): Promise<MemberProfile[]>;
  /** Adds a STAFF member with a grant; the member signs in with their phone + OTP afterwards. */
  add(input: {
    tenantId: string;
    businessName: string;
    name: string;
    phone: string;
    permissions: readonly string[];
    language: Language;
  }): Promise<MemberProfile>;
  /** Changes a staff member's grant or switches access on/off; a change applies at once. */
  update(input: {
    tenantId: string;
    memberId: string;
    permissions?: readonly string[] | undefined;
    active?: boolean | undefined;
    name?: string | undefined;
  }): Promise<MemberProfile>;
}

export interface TeamDeps {
  readonly members: MembersRepository;
  readonly refreshTokens: Pick<RefreshTokenService, 'revokeAll'>;
  readonly access: Pick<AccessEvents, 'permissionsChanged' | 'accessRevoked'>;
}

const notFound = (): NotFoundError => new NotFoundError({ code: ERROR_CODES.NOT_FOUND });

/** Owner-only team management of one merchant account (docs/BUSINESS_DOMAIN.md §6). */
export const createTeamService = ({ members, refreshTokens, access }: TeamDeps): TeamService => ({
  async list(tenantId) {
    return (await members.findTeam(tenantId)).map(toMemberProfile);
  },

  async add(input) {
    const permissions: Permission[] = normalizeGrant(input.permissions);
    try {
      const created = await members.create({
        tenantId: toObjectId(input.tenantId),
        businessName: input.businessName,
        name: input.name,
        phone: input.phone,
        role: 'STAFF',
        permissions,
        active: true,
        language: input.language,
      });
      return toMemberProfile(created);
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new ConflictError({ code: ERROR_CODES.PHONE_ALREADY_REGISTERED });
      throw error;
    }
  },

  async update({ tenantId, memberId, permissions, active, name }) {
    const updated = await members.updateStaff(tenantId, memberId, {
      ...(permissions === undefined ? {} : { permissions: normalizeGrant(permissions) }),
      ...(active === undefined ? {} : { active }),
      ...(name === undefined ? {} : { name }),
    });
    if (updated === null) throw notFound();
    if (active === false) {
      // A deactivated member loses every session and live connection now, not at token expiry.
      await refreshTokens.revokeAll('MEMBER', memberId);
      await access.accessRevoked({ scope: 'merchant', id: memberId });
    } else if (permissions !== undefined) {
      await access.permissionsChanged(memberId);
    }
    return toMemberProfile(updated);
  },
});
