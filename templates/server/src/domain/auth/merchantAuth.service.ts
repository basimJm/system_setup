import { ERROR_CODES } from '../../constants/errorCodes';
import {
  PERMISSIONS,
  type Language,
  type MemberRole,
  type Permission,
} from '../../constants/enums';
import type { MemberRaw } from '../../models/member.model';
import type { OtpProvider } from '../../providers';
import type { MembersRepository } from '../../repositories/identity.repository';
import { isDuplicateKeyError } from '../../utils/database/errors';
import type { Entity } from '../../utils/database/plain';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors';
import type { OtpGate } from '../otp/otpGate.service';
import type { SettingsService } from '../settings';
import { createPhoneVerifier } from './phoneVerifier';
import type { RefreshTokenService } from './refreshTokens.service';
import { createSessionTokens, type TokenPair } from './sessionTokens';

/** What the merchant app caches after sign-in; permissions refresh from the server. */
export interface MemberProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly businessName: string;
  readonly name: string;
  readonly phone: string;
  readonly role: MemberRole;
  /** The OWNER always has every permission; others get what the owner granted. */
  readonly permissions: readonly Permission[];
  readonly active: boolean;
  readonly language: Language;
  readonly photoKey?: string;
}

export interface MerchantSession extends TokenPair {
  readonly member: MemberProfile;
}

export interface MerchantRegisterInput {
  readonly businessName: string;
  readonly name: string;
  readonly phone: string;
  readonly otpToken: string;
  readonly pushToken?: string | undefined;
  readonly language: Language;
}

export interface MerchantAuthService {
  /** Before the OTP is sent: LOGIN needs an active member, REGISTER a free number. */
  checkPhone(input: { phone: string; purpose: 'LOGIN' | 'REGISTER' }): Promise<void>;
  /** Opens a merchant account: the caller becomes its OWNER. */
  register(input: MerchantRegisterInput): Promise<MerchantSession>;
  login(input: {
    phone: string;
    otpToken: string;
    pushToken?: string | undefined;
    language: Language;
  }): Promise<MerchantSession>;
  refresh(input: { refreshToken: string }): Promise<MerchantSession>;
  logout(input: { refreshToken: string }): Promise<void>;
}

export interface MerchantAuthDeps {
  readonly members: MembersRepository;
  readonly otp: OtpProvider;
  readonly otpGate: OtpGate;
  readonly refreshTokens: RefreshTokenService;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly accessSecret: string;
  readonly onRegistered?: (member: MemberProfile) => void;
  readonly now?: () => Date;
}

export const toMemberProfile = (member: Entity<MemberRaw>): MemberProfile => ({
  id: member.id,
  tenantId: member.tenantId,
  businessName: member.businessName,
  name: member.name,
  phone: member.phone,
  role: member.role,
  permissions: member.role === 'OWNER' ? PERMISSIONS : member.permissions,
  active: member.active,
  language: member.language,
  ...(member.photoKey === undefined ? {} : { photoKey: member.photoKey }),
});

const notLinked = (): NotFoundError =>
  new NotFoundError({ code: ERROR_CODES.PHONE_NOT_REGISTERED });
const inactive = (): ForbiddenError => new ForbiddenError({ code: ERROR_CODES.MEMBER_INACTIVE });
const phoneTaken = (): ConflictError =>
  new ConflictError({ code: ERROR_CODES.PHONE_ALREADY_REGISTERED });

/**
 * Merchant sign-in. An owner registers the account; staff are added by the owner (team module), so
 * an unknown number at login gets `PHONE_NOT_REGISTERED`. The JWT carries only the member and
 * scope; role, permissions and tenant are loaded from the database on every request.
 */
export const createMerchantAuthService = (deps: MerchantAuthDeps): MerchantAuthService => {
  const { members, otp, otpGate, refreshTokens } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const phones = createPhoneVerifier({ otp, otpGate });
  const tokens = createSessionTokens({
    refreshTokens,
    settings: deps.settings,
    accessSecret: deps.accessSecret,
    now,
  });

  /** The active member behind a number; unknown and deactivated members get their own errors. */
  const activeMember = async (e164: string): Promise<Entity<MemberRaw>> => {
    const member = await members.findByPhone(e164);
    if (member === null) throw notLinked();
    if (!member.active) throw inactive();
    return member;
  };

  const openSession = async (
    member: Entity<MemberRaw>,
    change: { pushToken?: string | undefined; language: Language },
  ): Promise<MerchantSession> => {
    const updated =
      (await members.updateById(member.id, {
        language: change.language,
        ...(change.pushToken === undefined ? {} : { pushToken: change.pushToken }),
      })) ?? member;
    const pair = await tokens.open('MEMBER', member.id);
    return { ...pair, member: toMemberProfile(updated) };
  };

  return {
    async checkPhone({ phone, purpose }) {
      if (purpose === 'REGISTER') {
        if ((await members.findByPhone(phone)) !== null) throw phoneTaken();
        return;
      }
      await activeMember(phone);
    },

    async register(input) {
      await phones.verify(input.phone, input.otpToken, 'REGISTER');
      if ((await members.findByPhone(input.phone)) !== null) throw phoneTaken();
      let owner: Entity<MemberRaw>;
      try {
        owner = await members.createOwner({
          businessName: input.businessName,
          name: input.name,
          phone: input.phone,
          active: true,
          language: input.language,
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) throw phoneTaken();
        throw error;
      }
      await otpGate.reset(input.phone);
      const session = await openSession(owner, input);
      deps.onRegistered?.(session.member);
      return session;
    },

    async login({ phone, otpToken, pushToken, language }) {
      await phones.verify(phone, otpToken, 'LOGIN');
      const member = await activeMember(phone);
      await otpGate.reset(phone);
      return openSession(member, { pushToken, language });
    },

    async refresh({ refreshToken }) {
      const next = await tokens.rotate(refreshToken);
      const member = await members.findById(next.subjectId);
      if (member === null || !member.active) {
        // Removed or deactivated by the owner since the session began: end every session.
        await refreshTokens.revokeAll('MEMBER', next.subjectId);
        throw member === null ? new UnauthorizedError() : inactive();
      }
      return { ...next.tokens, member: toMemberProfile(member) };
    },

    async logout({ refreshToken }) {
      const ended = await refreshTokens.revoke(refreshToken);
      if (ended !== null) await members.clearPushToken(ended.subjectId);
    },
  };
};
