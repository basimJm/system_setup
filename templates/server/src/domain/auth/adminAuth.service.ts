import { ERROR_CODES } from '../../constants/errorCodes';
import { MS_PER_SECOND } from '../../constants/time';
import type { AdminsRepository } from '../../repositories/identity.repository';
import { hashPassword, verifyPassword } from '../../utils/auth/password';
import { RateLimitError, UnauthorizedError } from '../../utils/errors';
import type { Logger } from '../../utils/logger';
import type { SettingsService } from '../settings';
import type { RefreshTokenService } from './refreshTokens.service';
import { createSessionTokens, type TokenPair } from './sessionTokens';

export interface AdminIdentity {
  readonly id: string;
  readonly email: string;
}

export interface AdminSession extends TokenPair {
  readonly admin: AdminIdentity;
}

export interface AdminAuthService {
  /**
   * The admin behind an email for the second factor: 401 when unknown, 429 while locked, so a
   * locked account cannot try codes either.
   */
  identify(email: string): Promise<AdminIdentity>;
  /** A wrong second factor counts like a wrong password (same lockout). */
  recordSecondFactorFailure(input: { adminId: string; ip: string }): Promise<void>;
  /**
   * First factor: email + password with lockout. Throws 401 for an unknown email and for a wrong
   * password (same answer), 429 while locked. Opens no session: the second factor does.
   */
  verifyCredentials(input: { email: string; password: string; ip: string }): Promise<AdminIdentity>;
  /** After every factor passed: tokens (idle-timeout refresh token), failure count cleared. */
  openSession(input: { adminId: string; ip: string }): Promise<AdminSession>;
  refresh(input: { refreshToken: string }): Promise<AdminSession>;
  logout(input: { refreshToken: string }): Promise<void>;
}

export interface AdminAuthDeps {
  readonly admins: AdminsRepository;
  readonly refreshTokens: RefreshTokenService;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly logger: Logger;
  readonly accessSecret: string;
  readonly now?: () => Date;
  /** bcrypt work factor used for the timing-equalising dummy hash (tests pass a cheap one). */
  readonly bcryptCost?: number;
}

const DUMMY_PASSWORD = 'timing-equaliser';

/**
 * Admin sign-in rules (Admin PRD §4): lockout after `admin.maxFailedLogins` wrong passwords for
 * `admin.lockSec`, and a session that ends after `admin.sessionIdleSec` without a refresh (the
 * refresh token lives exactly that long and every rotation restarts it).
 */
export const createAdminAuthService = (deps: AdminAuthDeps): AdminAuthService => {
  const { admins, refreshTokens, settings, logger } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const tokens = createSessionTokens({
    refreshTokens,
    settings,
    accessSecret: deps.accessSecret,
    now,
    refreshLifetime: async () => ({ ttlSec: await settings.get('admin.sessionIdleSec') }),
  });

  // An unknown email still pays for one bcrypt comparison, so response time does not reveal it.
  let dummyHash: Promise<string> | undefined;
  const burnComparison = async (password: string): Promise<void> => {
    dummyHash ??= hashPassword(DUMMY_PASSWORD, deps.bcryptCost);
    await verifyPassword(password, await dummyHash);
  };

  /** Counts a wrong password or code; the failure that reaches the limit locks the account. */
  const recordFailure = async (adminId: string, ip: string): Promise<void> => {
    const [maxFailures, lockSec] = await Promise.all([
      settings.get('admin.maxFailedLogins'),
      settings.get('admin.lockSec'),
    ]);
    const lockedUntil = await admins.recordFailedLogin(
      adminId,
      maxFailures,
      lockSec * MS_PER_SECOND,
      now(),
    );
    if (lockedUntil !== null) logger.warn({ adminId, ip, lockedUntil }, 'admin account locked');
  };

  const assertUnlocked = (admin: { lockedUntil?: Date | undefined }): void => {
    if (admin.lockedUntil !== undefined && admin.lockedUntil.getTime() > now().getTime()) {
      throw new RateLimitError({ code: ERROR_CODES.RATE_LIMITED });
    }
  };

  return {
    async identify(email) {
      const admin = await admins.findByEmail(email);
      if (admin === null) throw new UnauthorizedError();
      assertUnlocked(admin);
      return { id: admin.id, email: admin.email };
    },

    recordSecondFactorFailure({ adminId, ip }) {
      return recordFailure(adminId, ip);
    },

    async verifyCredentials({ email, password, ip }) {
      const admin = await admins.findByEmail(email);
      if (admin === null) {
        await burnComparison(password);
        throw new UnauthorizedError();
      }
      // Refused before the password is looked at, so a locked account cannot be probed.
      assertUnlocked(admin);
      if (await verifyPassword(password, admin.passwordHash)) {
        return { id: admin.id, email: admin.email };
      }
      await recordFailure(admin.id, ip);
      throw new UnauthorizedError();
    },

    async openSession({ adminId, ip }) {
      const admin = await admins.recordLogin(adminId, ip, now());
      if (admin === null) throw new UnauthorizedError();
      const pair = await tokens.open('ADMIN', admin.id);
      return { ...pair, admin: { id: admin.id, email: admin.email } };
    },

    async refresh({ refreshToken }) {
      const next = await tokens.rotate(refreshToken);
      const admin = await admins.findById(next.subjectId);
      if (admin === null) {
        await refreshTokens.revokeAll('ADMIN', next.subjectId);
        throw new UnauthorizedError();
      }
      return { ...next.tokens, admin: { id: admin.id, email: admin.email } };
    },

    async logout({ refreshToken }) {
      await refreshTokens.revoke(refreshToken);
    },
  };
};
