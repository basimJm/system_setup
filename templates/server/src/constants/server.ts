/** HTTP server wiring constants. */
export const API_PREFIXES = {
  customer: '/customer/v1',
  merchant: '/merchant/v1',
  admin: '/admin/v1',
} as const;

export type ApiNamespace = keyof typeof API_PREFIXES;

/** Largest JSON body accepted; larger requests are answered with 413. */
export const JSON_BODY_LIMIT = '100kb';

/** Request parts the `validate` middleware can check, in reporting order. */
export const VALIDATION_PARTS = ['body', 'params', 'query', 'headers'] as const;
export type ValidationPart = (typeof VALIDATION_PARTS)[number];

export const FIELD_PATH_SEPARATOR = '.';
