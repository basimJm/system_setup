import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_SECRET_MIN_LENGTH } from '../../../constants/env';
import {
  OTP_CODE_HASH_ENCODING,
  OTP_CODE_RADIX,
  OTP_KEY_PREFIX,
  OTP_PROOF,
} from '../../../constants/otp';
import { E164_PATTERN } from '../../../constants/providers';
import { MS_PER_SECOND } from '../../../constants/time';
import { ERROR_CODES } from '../../../constants/errorCodes';
import { BusinessRuleError, ExternalServiceError } from '../../../utils/errors';
import type { Logger } from '../../../utils/logger';
import { redisKey } from '../../../utils/redis/keys';
import type {
  OtpCodeInput,
  OtpCodeResult,
  OtpCodeRules,
  OtpProvider,
  OtpSendInput,
} from '../types';
import { OtpDeliveryError, type OtpChannel } from './channel';
import { createProofs } from './proofs';
import type { CodeStore } from './store';

export interface CodeOtpOptions {
  /** Delivers the code. A fake channel is refused in production. */
  readonly channel: OtpChannel;
  /** Code hashes and used-proof flags; a shared store is required in production. */
  readonly store: CodeStore;
  /** HMAC secret for codes at rest (>= 32 chars). */
  readonly codeSecret: string;
  /** HMAC secret of the `otpToken` (>= 32 chars, different from `codeSecret`). */
  readonly proofSecret: string;
  readonly isProduction: boolean;
  /** Dev only: every code is this value (refused in production). */
  readonly fixedCode?: string;
  readonly logger?: Logger;
  readonly now?: () => Date;
  /** CSPRNG integer in [0, maxExclusive) (tests inject a fixed one). */
  readonly randomInt?: (maxExclusive: number) => number;
}

const DIGITS = /^\d+$/;
/** `createProofs` wants a lifetime for issuing; verification only reads the proof's own `exp`. */
const VERIFY_TTL_PLACEHOLDER_SEC = 1;

const checkOptions = (options: CodeOtpOptions): void => {
  if (options.codeSecret.length < OTP_SECRET_MIN_LENGTH)
    throw new RangeError('code secret is too short');
  if (options.codeSecret === options.proofSecret)
    throw new RangeError('code and proof secrets must differ');
  if (options.fixedCode !== undefined && !DIGITS.test(options.fixedCode))
    throw new RangeError('fixedCode must be digits');
  if (!options.isProduction) return;
  if (options.channel.isFake === true)
    throw new RangeError('a fake channel is refused in production');
  if (options.store.scope === 'local')
    throw new RangeError('a process-local code store is refused in production');
  if (options.fixedCode !== undefined) throw new RangeError('fixedCode is refused in production');
};

/**
 * Server-generated OTP over any channel (docs/BUSINESS_DOMAIN.md §3.1a): CSPRNG code, HMAC at rest
 * with a TTL, single use, then a signed single-use proof. Limits stay with `OtpGate`. The code rules
 * (length, lifetimes) come with every call, so an admin change of a setting applies at once.
 */
export const createCodeOtp = (options: CodeOtpOptions): OtpProvider => {
  checkOptions(options);
  const { channel, store, logger } = options;
  const now = options.now ?? ((): Date => new Date());
  const draw = options.randomInt ?? ((max: number): number => randomInt(0, max));
  const proofsFor = (ttlSec: number): ReturnType<typeof createProofs> =>
    createProofs({ secret: options.proofSecret, store, ttlSec, now });
  const keyOf = (phone: string, purpose: string): string =>
    redisKey(OTP_KEY_PREFIX.code, purpose, phone);
  const hash = (phone: string, purpose: string, code: string): Buffer =>
    createHmac(OTP_PROOF.hmacAlgorithm, options.codeSecret)
      .update(`${purpose}\n${phone}\n${code}`)
      .digest();
  const newCode = (length: number): string => {
    if (options.fixedCode !== undefined)
      return options.fixedCode.padStart(length, '0').slice(-length);
    return String(draw(OTP_CODE_RADIX ** length)).padStart(length, '0');
  };

  return {
    async sendCode(input: OtpSendInput, rules: OtpCodeRules) {
      if (!E164_PATTERN.test(input.phone)) throw new RangeError('phone must be E.164');
      const code = newCode(rules.codeLength);
      const key = keyOf(input.phone, input.purpose);
      await store.set(
        key,
        hash(input.phone, input.purpose, code).toString(OTP_CODE_HASH_ENCODING),
        rules.codeTtlSec * MS_PER_SECOND,
      );
      try {
        await channel.send({
          to: input.phone,
          code,
          language: input.language,
          purpose: input.purpose,
          ttlSec: rules.codeTtlSec,
          ...(input.ip === undefined ? {} : { ip: input.ip }),
        });
      } catch (error) {
        // No code went out, so the stored hash is useless.
        await store.delete(key);
        if (error instanceof OtpDeliveryError) {
          throw new BusinessRuleError({ code: ERROR_CODES.OTP_DELIVERY_FAILED, cause: error });
        }
        logger?.error({ err: error, channel: channel.name }, 'otp channel failed');
        throw new ExternalServiceError({ cause: error, unavailable: true });
      }
      logger?.info(
        { channel: channel.name, purpose: input.purpose, phone: input.phone },
        'otp code sent',
      );
      return { expiresInSeconds: rules.codeTtlSec };
    },

    async verifyCode(input: OtpCodeInput, rules: OtpCodeRules): Promise<OtpCodeResult> {
      const key = keyOf(input.phone, input.purpose);
      const stored = await store.get(key);
      if (stored === null) return { outcome: 'EXPIRED' };
      const given = hash(input.phone, input.purpose, input.code);
      const expected = Buffer.from(stored, OTP_CODE_HASH_ENCODING);
      if (given.length !== expected.length || !timingSafeEqual(given, expected))
        return { outcome: 'INVALID_CODE' };
      // Only the caller that removes the code wins; a concurrent duplicate sees it gone.
      if (!(await store.delete(key))) return { outcome: 'EXPIRED' };
      const issued = proofsFor(rules.proofTtlSec).issue({
        phone: input.phone,
        purpose: input.purpose,
      });
      return { outcome: 'VERIFIED', ...issued };
    },

    verify(input) {
      // Checking needs no lifetime: the proof carries its own `exp`.
      return proofsFor(VERIFY_TTL_PLACEHOLDER_SEC).verify(input);
    },
  };
};
