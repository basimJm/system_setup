/** OTP platform limits and routes (docs/BUSINESS_DOMAIN.md §3.1, §3.1a and §10). */
export const OTP_KEY_PREFIX = {
  requests: 'otp:req',
  wrong: 'otp:wrong',
  /** Shared by requests and wrong codes: either limit blocks both. */
  block: 'otp:block',
  resend: 'otp:resend',
  /** Hashed codes (`otp:code:{purpose}:{e164}`) and used proofs (`otp:used:{jti}`). */
  code: 'otp:code',
  used: 'otp:used',
} as const;

/** What a verification is for, per app. Features add their purposes to `OTP_PURPOSES` first. */
export const CUSTOMER_OTP_PURPOSES = ['LOGIN', 'REGISTER', 'CHANGE_PHONE'] as const;
export const MERCHANT_OTP_PURPOSES = ['LOGIN', 'REGISTER'] as const;

export const OTP_ROUTES = {
  base: '/auth/otp',
  request: '/request',
  verify: '/verify',
} as const;

/** Random bytes of a per-process secret the fake provider makes when OTP_*_SECRET is unset (dev). */
export const OTP_GENERATED_SECRET_BYTES = 32;

/** A typed code: digits only, as long as `otp.length` allows (settings limits 4..10). */
export const OTP_CODE_PATTERN = /^[0-9]{4,10}$/;
export const OTP_CODE_RADIX = 10;
/** The wrong-code error detail: points at the typed code and says how many attempts are left. */
export const OTP_WRONG_CODE_DETAIL = {
  field: 'body.code',
  messageKey: 'otp.attemptsRemaining',
} as const;

/** Upper bound on the `otpToken` the apps send back (a signed proof of ~200 characters). */
export const OTP_TOKEN_MAX_LENGTH = 2048;
/** Signed proof format: `base64url(payload).base64url(hmac)`. */
export const OTP_PROOF = {
  version: 1,
  separator: '.',
  encoding: 'base64url',
  hmacAlgorithm: 'sha256',
  usedFlag: '1',
} as const;
export const OTP_CODE_HASH_ENCODING = 'hex';

/** Per-IP guard on the OTP endpoints, on top of the per-phone limits and the global limiter. */
export const OTP_ROUTE_RATE_LIMIT = { windowMs: 60_000, max: 20 } as const;
