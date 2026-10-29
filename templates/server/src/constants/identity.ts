/** Identity and session collections (docs/BUSINESS_DOMAIN.md §3.1). */
export const CUSTOMERS_COLLECTION = 'customers';
export const MEMBERS_COLLECTION = 'members';
export const REFRESH_TOKENS_COLLECTION = 'refreshTokens';
export const ADMINS_COLLECTION = 'admins';

export const PERSON_NAME_MIN_LENGTH = 1;
export const PERSON_NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;
/** Device push token (FCM / APNs) kept on the account that signed in last with it. */
export const PUSH_TOKEN_MAX_LENGTH = 4_096;
/** SHA-256 in hex: the only form in which a refresh token is stored. */
export const TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/;
export const SUBJECT_ID_FAMILY_MAX_LENGTH = 64;
export const REVOKED_REASON_MAX_LENGTH = 100;
export const PASSWORD_HASH_MAX_LENGTH = 100;
export const BLOCKED_REASON_MAX_LENGTH = 500;
