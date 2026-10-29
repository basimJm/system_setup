import { MONGO_DUPLICATE_KEY_CODE } from '../../constants/errorMapping';

/** Did MongoDB refuse a write because a unique index already holds that value (error 11000)? */
export const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { readonly code?: unknown }).code === MONGO_DUPLICATE_KEY_CODE;

/**
 * Field names of the unique index behind a duplicate-key error (`keyPattern`), or `null` when the
 * driver did not say, so callers can tell which unique value collided.
 */
export const duplicateKeyFields = (error: unknown): string[] | null => {
  const pattern = (error as { readonly keyPattern?: unknown } | null)?.keyPattern;
  return typeof pattern === 'object' && pattern !== null ? Object.keys(pattern) : null;
};
