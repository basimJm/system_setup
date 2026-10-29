import { ERROR_CODES } from '../../constants/errorCodes';
import type { Language } from '../../constants/enums';
import type { PhoneCheckPurpose } from '../../constants/customerAuth';
import type { OtpProvider } from '../../providers';
import type { CustomersRepository } from '../../repositories/identity.repository';
import { isDuplicateKeyError } from '../../utils/database/errors';
import type { Entity } from '../../utils/database/plain';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors';
import type { CustomerRaw } from '../../models/customer.model';
import type { OtpGate } from '../otp/otpGate.service';
import type { SettingsService } from '../settings';
import { createPhoneVerifier } from './phoneVerifier';
import type { RefreshTokenService } from './refreshTokens.service';
import { createSessionTokens, type TokenPair } from './sessionTokens';

export interface RegisterInput {
  readonly name: string;
  /** E.164. */
  readonly phone: string;
  readonly email?: string | undefined;
  /** `otpToken` from `POST /auth/otp/verify` (purpose REGISTER). */
  readonly otpToken: string;
  readonly pushToken?: string | undefined;
  readonly language: Language;
}

export interface LoginInput {
  readonly phone: string;
  readonly otpToken: string;
  readonly pushToken?: string | undefined;
  readonly language: Language;
}

export interface CustomerProfile {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly email?: string;
  readonly language: Language;
  readonly avatarKey?: string;
}

export interface CustomerSession extends TokenPair {
  readonly customer: CustomerProfile;
}

export interface CustomerAuthService {
  /** Before the OTP is sent: is the number usable for this mode? */
  checkPhone(input: { phone: string; purpose: PhoneCheckPurpose }): Promise<void>;
  register(input: RegisterInput): Promise<CustomerSession>;
  login(input: LoginInput): Promise<CustomerSession>;
  refresh(input: { refreshToken: string }): Promise<CustomerSession>;
  logout(input: { refreshToken: string }): Promise<void>;
  changePhone(input: {
    customerId: string;
    phone: string;
    otpToken: string;
  }): Promise<CustomerProfile>;
}

export interface CustomerAuthDeps {
  readonly customers: CustomersRepository;
  readonly otp: OtpProvider;
  readonly otpGate: OtpGate;
  readonly refreshTokens: RefreshTokenService;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly accessSecret: string;
  /** Called once after a new account was created (welcome notification, analytics). */
  readonly onRegistered?: (customer: CustomerProfile) => void;
  readonly now?: () => Date;
}

export const toCustomerProfile = (customer: Entity<CustomerRaw>): CustomerProfile => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  ...(customer.email === undefined ? {} : { email: customer.email }),
  language: customer.language,
  ...(customer.avatarKey === undefined ? {} : { avatarKey: customer.avatarKey }),
});

const accountBlocked = (): ForbiddenError =>
  new ForbiddenError({ code: ERROR_CODES.ACCOUNT_BLOCKED });
const phoneTaken = (): ConflictError =>
  new ConflictError({ code: ERROR_CODES.PHONE_ALREADY_REGISTERED });
const phoneUnknown = (): NotFoundError =>
  new NotFoundError({ code: ERROR_CODES.PHONE_NOT_REGISTERED });

/**
 * Customer register, login, refresh, logout and phone change. The phone is only trusted after the
 * OTP provider confirms the `otpToken` for that exact number; the platform limits gate every attempt.
 */
export const createCustomerAuthService = (deps: CustomerAuthDeps): CustomerAuthService => {
  const { customers, otp, otpGate, refreshTokens } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const phones = createPhoneVerifier({ otp, otpGate });
  const tokens = createSessionTokens({
    refreshTokens,
    settings: deps.settings,
    accessSecret: deps.accessSecret,
    now,
  });

  const openSession = async (
    customer: Entity<CustomerRaw>,
    change: { pushToken?: string | undefined; language: Language },
  ): Promise<CustomerSession> => {
    const updated =
      (await customers.updateById(customer.id, {
        lastActiveAt: now(),
        language: change.language,
        ...(change.pushToken === undefined ? {} : { pushToken: change.pushToken }),
      })) ?? customer;
    const pair = await tokens.open('CUSTOMER', customer.id);
    return { ...pair, customer: toCustomerProfile(updated) };
  };

  return {
    async checkPhone({ phone, purpose }) {
      const customer = await customers.findByPhone(phone);
      if (purpose === 'REGISTER') {
        if (customer !== null) throw phoneTaken();
        return;
      }
      if (customer === null) throw phoneUnknown();
      if (customer.status === 'BLOCKED') throw accountBlocked();
    },

    async register(input) {
      await phones.verify(input.phone, input.otpToken, 'REGISTER');
      if ((await customers.findByPhone(input.phone)) !== null) throw phoneTaken();
      let created: Entity<CustomerRaw>;
      try {
        created = await customers.create({
          name: input.name,
          phone: input.phone,
          ...(input.email === undefined ? {} : { email: input.email }),
          language: input.language,
          status: 'ACTIVE',
        });
      } catch (error) {
        // Two sign-ups for one number at once: the unique index decides.
        if (isDuplicateKeyError(error)) throw phoneTaken();
        throw error;
      }
      await otpGate.reset(input.phone);
      const session = await openSession(created, input);
      deps.onRegistered?.(session.customer);
      return session;
    },

    async login(input) {
      await phones.verify(input.phone, input.otpToken, 'LOGIN');
      const found = await customers.findByPhone(input.phone);
      if (found === null) throw phoneUnknown();
      if (found.status === 'BLOCKED') throw accountBlocked();
      await otpGate.reset(input.phone);
      return openSession(found, input);
    },

    async refresh({ refreshToken }) {
      const next = await tokens.rotate(refreshToken);
      const customer = await customers.findById(next.subjectId);
      if (customer === null || customer.status !== 'ACTIVE') {
        // The account was blocked or removed since the session began: end every session.
        await refreshTokens.revokeAll('CUSTOMER', next.subjectId);
        throw customer?.status === 'BLOCKED' ? accountBlocked() : new UnauthorizedError();
      }
      return { ...next.tokens, customer: toCustomerProfile(customer) };
    },

    async logout({ refreshToken }) {
      const ended = await refreshTokens.revoke(refreshToken);
      // The device stops receiving pushes for this account.
      if (ended !== null) await customers.patch(ended.subjectId, { set: {}, unset: ['pushToken'] });
    },

    async changePhone({ customerId, phone, otpToken }) {
      const customer = await customers.findById(customerId);
      if (customer === null || customer.status !== 'ACTIVE') throw new UnauthorizedError();
      await phones.verify(phone, otpToken, 'CHANGE_PHONE');
      const owner = await customers.findByPhone(phone);
      if (owner !== null && owner.id !== customer.id) throw phoneTaken();
      let updated: Entity<CustomerRaw> | null;
      try {
        updated = await customers.updateById(customer.id, { phone });
      } catch (error) {
        if (isDuplicateKeyError(error)) throw phoneTaken();
        throw error;
      }
      if (updated === null) throw new UnauthorizedError();
      await otpGate.reset(phone);
      return toCustomerProfile(updated);
    },
  };
};
