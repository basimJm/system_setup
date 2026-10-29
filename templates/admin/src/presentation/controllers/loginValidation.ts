import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH, OTP_LENGTH } from '@/constants/auth';

export type LoginField = 'email' | 'password' | 'code';
/** Values are i18n keys, resolved by the view. */
export type FieldErrors = Partial<Record<LoginField, string>>;

export function validateCredentials(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'login.errors.email';
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = 'login.errors.password';
  return errors;
}

export function validateCode(code: string): FieldErrors {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code) ? {} : { code: 'login.errors.code' };
}

/** Only same-origin paths may be used as a post-login target (no open redirect). */
export function safeRedirect(next: string | null, fallback: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
    ? next
    : fallback;
}
