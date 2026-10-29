/** Client-side error kinds. Every kind has an `errors.<kind>` message in both locales. */
export const ERROR_KINDS = [
  'network',
  'timeout',
  'unauthorized',
  'forbidden',
  'notFound',
  'validation',
  'conflict',
  'rateLimited',
  'server',
  'parse',
  'config',
  'unknown',
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export const ERROR_MESSAGE_PREFIX = 'errors.';

/** Codes shown on the full-page notices. */
export const HTTP_CODES = { forbidden: 403, notFound: 404, serverError: 500 } as const;
