import type { Redis } from 'ioredis';
import { ERROR_CODES } from '../../constants/errorCodes';
import { OTP_KEY_PREFIX } from '../../constants/otp';
import { MS_PER_SECOND } from '../../constants/time';
import { RateLimitError } from '../../utils/errors';
import { startCooldown } from '../../utils/redis/counter';
import { redisKey } from '../../utils/redis/keys';
import { createLimiter, toRetryAfterSec, type Limiter } from '../../utils/redis/limiter';
import type { SettingsService } from '../settings';

export interface OtpRequestDecision {
  /** The limits allow a new code now (the server then sends it). */
  readonly allowed: boolean;
  readonly otpLength: number;
  /** Seconds until the next request is allowed (the resend countdown). */
  readonly resendAfterSeconds: number;
  /** Set while the phone is blocked. */
  readonly blockedUntil?: Date;
}

export interface WrongAttemptResult {
  readonly blocked: boolean;
  readonly blockedUntil?: Date;
  readonly attemptsRemaining: number;
}

export interface OtpGate {
  /** Limits before a code is sent: platform limits, `otpLength`, resend timing. */
  request(e164: string): Promise<OtpRequestDecision>;
  /** A wrong code typed at `POST …/auth/otp/verify`; counts toward the wrong-attempts block. */
  reportWrongAttempt(e164: string): Promise<WrongAttemptResult>;
  /** Throws `OTP_BLOCKED` (429) while the phone is blocked; verification endpoints call it first. */
  assertNotBlocked(e164: string): Promise<void>;
  /** Clears counters, block and resend cooldown after a successful verification. */
  reset(e164: string): Promise<void>;
}

export interface OtpGateDeps {
  readonly redis: Redis;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly now?: () => Date;
}

/**
 * OTP abuse limits (Customer PRD S13, BUSINESS_DOMAIN §3.1a step 2). All numbers come from
 * settings and are read per call, so an admin change applies at once. State lives in Redis and is
 * shared by every API instance. The request that reaches the limit is allowed and starts the block.
 */
export const createOtpGate = ({
  redis,
  settings,
  now = () => new Date(),
}: OtpGateDeps): OtpGate => {
  const limiters = async (): Promise<{ requests: Limiter; wrong: Limiter }> => {
    const [maxRequests, requestWindowSec, maxWrong, blockSec] = await Promise.all([
      settings.get('otp.maxRequests'),
      settings.get('otp.requestWindowSec'),
      settings.get('otp.maxWrong'),
      settings.get('otp.blockSec'),
    ]);
    const blockMs = blockSec * MS_PER_SECOND;
    return {
      requests: createLimiter(redis, {
        counterPrefix: OTP_KEY_PREFIX.requests,
        blockPrefix: OTP_KEY_PREFIX.block,
        limit: maxRequests,
        windowMs: requestWindowSec * MS_PER_SECOND,
        blockMs,
      }),
      // The wrong-code counter lives as long as a block (BUSINESS_DOMAIN.md §3.1).
      wrong: createLimiter(redis, {
        counterPrefix: OTP_KEY_PREFIX.wrong,
        blockPrefix: OTP_KEY_PREFIX.block,
        limit: maxWrong,
        windowMs: blockMs,
        blockMs,
      }),
    };
  };
  const until = (retryAfterMs: number): Date => new Date(now().getTime() + retryAfterMs);

  return {
    async request(e164) {
      const [otpLength, resendAfterSec, { requests }] = await Promise.all([
        settings.get('otp.length'),
        settings.get('otp.resendAfterSec'),
        limiters(),
      ]);
      const blocked = (retryAfterMs: number): OtpRequestDecision => ({
        allowed: false,
        otpLength,
        resendAfterSeconds: 0,
        blockedUntil: until(retryAfterMs),
      });
      const status = await requests.status(e164);
      if (status.blocked) return blocked(status.retryAfterMs);

      const cooldown = await startCooldown(
        redis,
        redisKey(OTP_KEY_PREFIX.resend, e164),
        resendAfterSec * MS_PER_SECOND,
      );
      if (!cooldown.started) {
        return {
          allowed: false,
          otpLength,
          resendAfterSeconds: toRetryAfterSec(cooldown.retryAfterMs),
        };
      }
      const hit = await requests.hit(e164);
      if (!hit.allowed) return blocked(hit.retryAfterMs);
      return { allowed: true, otpLength, resendAfterSeconds: resendAfterSec };
    },

    async reportWrongAttempt(e164) {
      const { wrong } = await limiters();
      const hit = await wrong.hit(e164);
      return {
        blocked: hit.blocked,
        ...(hit.blocked ? { blockedUntil: until(hit.retryAfterMs) } : {}),
        attemptsRemaining: hit.remaining,
      };
    },

    async assertNotBlocked(e164) {
      const { requests } = await limiters();
      if ((await requests.status(e164)).blocked) {
        throw new RateLimitError({ code: ERROR_CODES.OTP_BLOCKED });
      }
    },

    async reset(e164) {
      const { requests, wrong } = await limiters();
      await Promise.all([
        requests.reset(e164),
        wrong.reset(e164),
        redis.del(redisKey(OTP_KEY_PREFIX.resend, e164)),
      ]);
    },
  };
};
