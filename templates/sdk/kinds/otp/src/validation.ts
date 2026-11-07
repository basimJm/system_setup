import { E164_PATTERN, LANGUAGE_PATTERN, PURPOSE_PATTERN } from './constants/otp';
import { validationError } from './errors';

export const isE164 = (phone: string): boolean => E164_PATTERN.test(phone);

export const assertPhone = (phone: string): void => {
  if (typeof phone !== 'string' || !isE164(phone))
    throw validationError('phone must be E.164 (+ and 7-15 digits)');
};

export const assertPurpose = (purpose: string): void => {
  if (typeof purpose !== 'string' || !PURPOSE_PATTERN.test(purpose))
    throw validationError('purpose must be an UPPER_SNAKE identifier');
};

export const assertLanguage = (language: string): void => {
  if (typeof language !== 'string' || !LANGUAGE_PATTERN.test(language))
    throw validationError('language must be a BCP 47 tag such as ar or en-US');
};

export const assertCode = (code: string, length: number): void => {
  if (typeof code !== 'string' || code.length !== length || !/^\d+$/.test(code))
    throw validationError('code must have the configured number of digits');
};

export const assertToken = (token: string): void => {
  if (typeof token !== 'string' || !/^[0-9a-f]{16,}$/.test(token))
    throw validationError('otpToken has an invalid shape');
};

/** Masks a phone for logs: `+9917*****67`. */
export const maskPhone = (phone: string): string =>
  phone.length < 7
    ? '***'
    : `${phone.slice(0, 5)}${'*'.repeat(phone.length - 7)}${phone.slice(-2)}`;
