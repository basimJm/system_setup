/** Field encryption: AES-256-GCM with a random 96-bit IV per value. */
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const ENCRYPTION_KEY_BYTES = 32;
export const ENCRYPTION_IV_BYTES = 12;
export const ENCRYPTION_TAG_BYTES = 16;
/** Stored as `v1:<iv>:<tag>:<ciphertext>` (base64); the version allows rotating the scheme later. */
export const ENCRYPTION_VERSION = 'v1';
export const ENCRYPTION_SEPARATOR = ':';
export const ENCRYPTION_ENCODING = 'base64';
