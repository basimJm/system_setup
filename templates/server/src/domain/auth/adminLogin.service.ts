import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import {
  ADMIN_OTP_HASH_SEPARATOR,
  ADMIN_OTP_KEY_PREFIX,
  ADMIN_OTP_TTL_SEC,
} from '../../constants/adminAuth';
import { ERROR_CODES } from '../../constants/errorCodes';
import type { Language } from '../../constants/i18n';
import { MS_PER_MINUTE, MS_PER_SECOND } from '../../constants/time';
import type { Notifier } from '../../providers';
import type { AdminsRepository } from '../../repositories/identity.repository';
import { UnauthorizedError } from '../../utils/errors';
import { translate } from '../../utils/i18n';
import type { Logger } from '../../utils/logger';
import { flagTtlMs, startCooldown } from '../../utils/redis/counter';
import { redisKey } from '../../utils/redis/keys';
import { toRetryAfterSec } from '../../utils/redis/limiter';
import type { SettingsService } from '../settings';
import type { AdminAuthService, AdminSession } from './adminAuth.service';

export interface OtpChallenge {
  /** The emailed code stops working at this instant. */
  readonly expiresAt: Date;
  /** Seconds before another code can be requested. */
  readonly resendAfterSeconds: number;
}

export interface AdminLoginService {
  /** Step 1: password (lockout applies), then a code is emailed to the admin. */
  start(input: {
    email: string;
    password: string;
    ip: string;
    language: Language;
  }): Promise<OtpChallenge>;
  /** Step 2: the code opens the session. A wrong code counts toward the same lockout. */
  verify(input: {
    email: string;
    code: string;
    ip: string;
    language: Language;
  }): Promise<AdminSession>;
}

export interface AdminLoginDeps {
  readonly auth: AdminAuthService;
  readonly admins: AdminsRepository;
  readonly redis: Redis;
  readonly notifier: Notifier;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly logger: Logger;
  /** Keys the code hash, so a leaked Redis value cannot be brute-forced offline without it. */
  readonly secret: string;
  readonly now?: () => Date;
  readonly randomCode?: (length: number) => string;
}

const numericCode = (length: number): string =>
  randomInt(0, 10 ** length)
    .toString()
    .padStart(length, '0');

/**
 * Admin sign-in with an emailed second factor (Admin PRD §4, decision "Email OTP"). A password
 * alone never opens a session. Wrong codes use the password lockout, so guessing a code is as
 * limited as guessing a password; a code works once and expires after five minutes.
 */
export const createAdminLoginService = (deps: AdminLoginDeps): AdminLoginService => {
  const { auth, admins, redis, notifier, settings, logger } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const newCode = deps.randomCode ?? numericCode;

  const codeKey = (adminId: string): string => redisKey(ADMIN_OTP_KEY_PREFIX.code, adminId);
  const resendKey = (adminId: string): string => redisKey(ADMIN_OTP_KEY_PREFIX.resend, adminId);
  const hashCode = (adminId: string, code: string): string =>
    createHmac('sha256', deps.secret)
      .update(`${adminId}${ADMIN_OTP_HASH_SEPARATOR}${code}`)
      .digest('hex');
  const matches = (stored: string, adminId: string, code: string): boolean => {
    const left = Buffer.from(stored, 'hex');
    const right = Buffer.from(hashCode(adminId, code), 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  };

  return {
    async start({ email, password, ip, language }) {
      const admin = await auth.verifyCredentials({ email, password, ip });
      const resendAfterSec = await settings.get('otp.resendAfterSec');
      const cooldown = await startCooldown(
        redis,
        resendKey(admin.id),
        resendAfterSec * MS_PER_SECOND,
      );
      if (!cooldown.started) {
        // A code was just sent and still works; do not mail another one.
        const left = await flagTtlMs(redis, codeKey(admin.id));
        return {
          expiresAt: new Date(now().getTime() + left),
          resendAfterSeconds: toRetryAfterSec(cooldown.retryAfterMs),
        };
      }
      const code = newCode(await settings.get('otp.length'));
      const hash = hashCode(admin.id, code);
      await redis.set(codeKey(admin.id), hash, 'EX', ADMIN_OTP_TTL_SEC);
      try {
        await notifier.sendEmail({
          to: [admin.email],
          subject: translate(language, 'emails.adminOtp.subject'),
          text: translate(language, 'emails.adminOtp.body', {
            code,
            minutes: Math.round((ADMIN_OTP_TTL_SEC * MS_PER_SECOND) / MS_PER_MINUTE),
          }),
          idempotencyKey: `admin-otp:${admin.id}:${hash.slice(0, 16)}`,
        });
      } catch (error) {
        // No mail went out, so the code is useless and the admin may ask again at once.
        await redis.del(codeKey(admin.id), resendKey(admin.id));
        throw error;
      }
      return {
        expiresAt: new Date(now().getTime() + ADMIN_OTP_TTL_SEC * MS_PER_SECOND),
        resendAfterSeconds: resendAfterSec,
      };
    },

    async verify({ email, code, ip, language }) {
      const admin = await auth.identify(email);
      const stored = await redis.get(codeKey(admin.id));
      if (stored === null) throw new UnauthorizedError({ code: ERROR_CODES.OTP_EXPIRED });
      if (!matches(stored, admin.id, code)) {
        await auth.recordSecondFactorFailure({ adminId: admin.id, ip });
        throw new UnauthorizedError({ code: ERROR_CODES.OTP_INVALID });
      }
      // One use: of two requests with the right code only the one that deletes it gets in.
      if ((await redis.del(codeKey(admin.id))) === 0) {
        throw new UnauthorizedError({ code: ERROR_CODES.OTP_EXPIRED });
      }
      const previous = await admins.findById(admin.id);
      const session = await auth.openSession({ adminId: admin.id, ip });
      await redis.del(resendKey(admin.id));
      if (previous?.lastLoginIp !== undefined && previous.lastLoginIp !== ip) {
        await alertNewAddress(previous.alertEmails, admin.email, ip, language, admin.id);
      }
      return session;
    },
  };

  /** Best effort: a failed alert must never block a valid sign-in. */
  async function alertNewAddress(
    alertEmails: readonly string[],
    email: string,
    ip: string,
    language: Language,
    adminId: string,
  ): Promise<void> {
    try {
      await notifier.sendEmail({
        to: alertEmails.length > 0 ? alertEmails : [email],
        subject: translate(language, 'emails.adminNewDevice.subject'),
        text: translate(language, 'emails.adminNewDevice.body', { email, ip }),
        idempotencyKey: `admin-new-address:${adminId}:${String(now().getTime())}`,
      });
    } catch (error) {
      logger.warn({ adminId, err: error }, 'new-address alert email failed');
    }
  }
};
