/** Admin authentication . */
export const ADMIN_AUTH_ROUTES = {
  base: '/auth',
  refresh: '/refresh',
  logout: '/logout',
} as const;

/** bcrypt work factor; raise it as hardware gets faster. */
export const BCRYPT_COST = 12;
/** bcrypt only reads the first 72 bytes, so longer passwords are refused instead of truncated. */
export const PASSWORD_MAX_BYTES = 72;

/** Routes added by the second factor . */
export const ADMIN_LOGIN_ROUTES = {
  login: '/login',
  verifyOtp: '/verify-otp',
} as const;

/** The emailed sign-in code lives 5 minutes . */
export const ADMIN_OTP_TTL_SEC = 300;
export const ADMIN_OTP_KEY_PREFIX = {
  code: 'admin:otp',
  resend: 'admin:otp:resend',
} as const;
/** HMAC input separator between the admin id and the code. */
export const ADMIN_OTP_HASH_SEPARATOR = ':';
export const ADMIN_PASSWORD_INPUT_MAX_LENGTH = 256;
export const ADMIN_OTP_CODE_PATTERN = /^[0-9]{4,10}$/;
