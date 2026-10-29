import {
  CONTENT_TYPE_PATTERN,
  MAX_PRESIGN_TTL_SEC,
  OBJECT_KEY_MAX_LENGTH,
  OBJECT_KEY_PATTERN,
} from '../../constants/providers';

/**
 * The pattern forbids empty, `.` and `..` segments (a segment cannot start with a dot).
 * Programmer errors (the uploads module validates client input first), so `RangeError`.
 */
export const assertObjectKey = (key: string): void => {
  if (key.length === 0 || key.length > OBJECT_KEY_MAX_LENGTH || !OBJECT_KEY_PATTERN.test(key)) {
    throw new RangeError('invalid object key');
  }
};

export const assertContentType = (contentType: string): void => {
  if (!CONTENT_TYPE_PATTERN.test(contentType)) throw new RangeError('invalid content type');
};

export const assertPositiveInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive whole number`);
  }
};

export const assertTtl = (expiresInSec: number): void => {
  assertPositiveInteger(expiresInSec, 'expiresInSec');
  if (expiresInSec > MAX_PRESIGN_TTL_SEC) throw new RangeError('expiresInSec is too long');
};
