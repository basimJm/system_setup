import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { OTP_SECRET_MIN_LENGTH } from '../../../constants/env';
import { OTP_KEY_PREFIX, OTP_PROOF } from '../../../constants/otp';
import { E164_PATTERN, OTP_PURPOSES, type OtpPurpose } from '../../../constants/providers';
import { MS_PER_SECOND } from '../../../constants/time';
import { redisKey } from '../../../utils/redis/keys';
import type { OtpVerifyInput, OtpVerifyResult } from '../types';
import type { CodeStore } from './store';

export interface ProofOptions {
  /** HMAC secret of the proof (>= 32 chars, from the secret store). */
  readonly secret: string;
  /** Holds `otp:used:{jti}` flags; shared in production. */
  readonly store: CodeStore;
  /** Lifetime of an issued proof (`otp.proofTtlSec`). */
  readonly ttlSec: number;
  readonly now?: () => Date;
  /** Proof id generator (tests). */
  readonly newId?: () => string;
}

export interface IssuedProof {
  readonly otpToken: string;
  readonly expiresInSeconds: number;
}

export interface Proofs {
  /** Signs `{phone, purpose, jti, iat, exp}`; call it only after the code was checked. */
  issue(input: { readonly phone: string; readonly purpose: OtpPurpose }): IssuedProof;
  /** Checks signature, expiry, phone, purpose and single use (`otp:used:{jti}`). */
  verify(input: OtpVerifyInput): Promise<OtpVerifyResult>;
}

const payloadSchema = z.object({
  v: z.literal(OTP_PROOF.version),
  phone: z.string().regex(E164_PATTERN),
  purpose: z.enum(OTP_PURPOSES),
  jti: z.string().min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});
type Payload = z.infer<typeof payloadSchema>;

const INVALID: OtpVerifyResult = { outcome: 'INVALID_PROOF' };

const decode = (part: string): unknown => {
  try {
    return JSON.parse(Buffer.from(part, OTP_PROOF.encoding).toString()) as unknown;
  } catch {
    return null;
  }
};

/**
 * Signed single-use OTP proof: `base64url(payload).base64url(hmac)`. Stateless to check except
 * the single-use flag, which lives as long as the proof could.
 */
export const createProofs = (options: ProofOptions): Proofs => {
  if (options.secret.length < OTP_SECRET_MIN_LENGTH)
    throw new RangeError('proof secret is too short');
  if (!Number.isInteger(options.ttlSec) || options.ttlSec <= 0)
    throw new RangeError('proof ttlSec must be a positive integer');
  const now = options.now ?? ((): Date => new Date());
  const newId = options.newId ?? randomUUID;
  const sign = (body: string): Buffer =>
    createHmac(OTP_PROOF.hmacAlgorithm, options.secret).update(body).digest();
  const nowSec = (): number => Math.floor(now().getTime() / MS_PER_SECOND);

  const parse = (token: string): Payload | null => {
    const parts = token.split(OTP_PROOF.separator);
    const [body, signature] = parts;
    if (parts.length !== 2 || body === undefined || signature === undefined) return null;
    const given = Buffer.from(signature, OTP_PROOF.encoding);
    const expected = sign(body);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const parsed = payloadSchema.safeParse(decode(body));
    return parsed.success ? parsed.data : null;
  };

  return {
    issue({ phone, purpose }) {
      if (!E164_PATTERN.test(phone)) throw new RangeError('phone must be E.164');
      const iat = nowSec();
      const payload: Payload = {
        v: OTP_PROOF.version,
        phone,
        purpose,
        jti: newId(),
        iat,
        exp: iat + options.ttlSec,
      };
      const body = Buffer.from(JSON.stringify(payload)).toString(OTP_PROOF.encoding);
      const signature = sign(body).toString(OTP_PROOF.encoding);
      return {
        otpToken: `${body}${OTP_PROOF.separator}${signature}`,
        expiresInSeconds: options.ttlSec,
      };
    },

    async verify(input) {
      if (input.proof === '') return INVALID;
      const payload = parse(input.proof);
      if (payload === null) return INVALID;
      const remainingSec = payload.exp - nowSec();
      if (remainingSec <= 0) return { outcome: 'EXPIRED' };
      if (payload.phone !== input.expectedPhone) return { outcome: 'PHONE_MISMATCH' };
      if (payload.purpose !== input.purpose) return { outcome: 'PURPOSE_MISMATCH' };
      const first = await options.store.setIfAbsent(
        redisKey(OTP_KEY_PREFIX.used, payload.jti),
        OTP_PROOF.usedFlag,
        remainingSec * MS_PER_SECOND,
      );
      return first ? { outcome: 'VERIFIED', phone: payload.phone } : INVALID;
    },
  };
};
