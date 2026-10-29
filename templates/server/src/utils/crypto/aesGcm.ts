import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_ENCODING,
  ENCRYPTION_IV_BYTES,
  ENCRYPTION_KEY_BYTES,
  ENCRYPTION_SEPARATOR,
  ENCRYPTION_TAG_BYTES,
  ENCRYPTION_VERSION,
} from '../../constants/crypto';

/** Is this a base64 string holding exactly one AES-256 key? (Config validation; never logs the key.) */
export const isEncryptionKey = (value: string): boolean =>
  Buffer.from(value, ENCRYPTION_ENCODING).length === ENCRYPTION_KEY_BYTES &&
  Buffer.from(value, ENCRYPTION_ENCODING).toString(ENCRYPTION_ENCODING) === value;

export interface FieldEncryption {
  encrypt(plain: string): string;
  /** Throws when the value was changed, is malformed, or was made with another key. */
  decrypt(stored: string): string;
}

/**
 * AES-256-GCM for sensitive fields at rest. GCM
 * authenticates the data, so tampering is detected rather than silently decrypted to garbage.
 */
export const createFieldEncryption = (keyBase64: string): FieldEncryption => {
  const key = Buffer.from(keyBase64, ENCRYPTION_ENCODING);
  if (key.length !== ENCRYPTION_KEY_BYTES) throw new RangeError('invalid encryption key');
  return {
    encrypt(plain) {
      const iv = randomBytes(ENCRYPTION_IV_BYTES);
      const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
      const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [ENCRYPTION_VERSION, iv, cipher.getAuthTag(), body]
        .map((part) => (typeof part === 'string' ? part : part.toString(ENCRYPTION_ENCODING)))
        .join(ENCRYPTION_SEPARATOR);
    },
    decrypt(stored) {
      const [version, iv, tag, body, ...rest] = stored.split(ENCRYPTION_SEPARATOR);
      if (
        version !== ENCRYPTION_VERSION ||
        iv === undefined ||
        tag === undefined ||
        body === undefined ||
        rest.length > 0
      ) {
        throw new RangeError('malformed encrypted value');
      }
      const tagBytes = Buffer.from(tag, ENCRYPTION_ENCODING);
      if (tagBytes.length !== ENCRYPTION_TAG_BYTES)
        throw new RangeError('malformed encrypted value');
      const decipher = createDecipheriv(
        ENCRYPTION_ALGORITHM,
        key,
        Buffer.from(iv, ENCRYPTION_ENCODING),
      );
      decipher.setAuthTag(tagBytes);
      return Buffer.concat([
        decipher.update(Buffer.from(body, ENCRYPTION_ENCODING)),
        decipher.final(),
      ]).toString('utf8');
    },
  };
};
