/** API documentation constants. */
export const DOC_NAMES = ['common', 'customer', 'merchant', 'admin'] as const;
export type DocName = (typeof DOC_NAMES)[number];

export const OPENAPI_VERSION = '3.1.0';
export const DOCS_ROUTE = '/docs';
export const DOCS_OUTPUT_DIR = 'docs/api';
export const POSTMAN_OUTPUT_DIR = 'docs/api/postman';
export const POSTMAN_SCHEMA_URL =
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

export const DOC_TITLES: Readonly<Record<DocName, string>> = {
  common: 'Common',
  customer: 'Customer API',
  merchant: 'Merchant API',
  admin: 'Admin API',
};

export const BEARER_SCHEME = 'bearerAuth';

/** Postman collection variables. Values are filled by the developer, never committed. */
export const POSTMAN_VARIABLES = {
  baseUrl: 'baseUrl',
  language: 'language',
  tokens: {
    common: '',
    customer: 'customerToken',
    merchant: 'merchantToken',
    admin: 'adminToken',
  },
} as const;
export const POSTMAN_DEFAULT_LANGUAGE = 'ar';
/** First part of the generated Postman file names (`<PREFIX>-Customer.postman_collection.json`). */
export const POSTMAN_FILE_PREFIX = '__SYSTEM_PREFIX__';
export const POSTMAN_ENVIRONMENT_NAME = '__SYSTEM_NAME__ Local';
export const JSON_CONTENT_TYPE = 'application/json';
export const SCHEMA_REF_PREFIX = '#/components/schemas/';
export const MAX_EXAMPLE_DEPTH = 6;
