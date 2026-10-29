import bcrypt from 'bcryptjs';
import { BCRYPT_COST, PASSWORD_MAX_BYTES } from '../../constants/adminAuth';

const fits = (plain: string): boolean => Buffer.byteLength(plain, 'utf8') <= PASSWORD_MAX_BYTES;

/** bcrypt hash of a password; `cost` is a parameter so tests can use a cheap one. */
export const hashPassword = (plain: string, cost: number = BCRYPT_COST): Promise<string> => {
  if (plain === '') return Promise.reject(new RangeError('password must not be empty'));
  if (!fits(plain)) {
    return Promise.reject(
      new RangeError(`password must be at most ${String(PASSWORD_MAX_BYTES)} bytes`),
    );
  }
  return bcrypt.hash(plain, cost);
};

/** Constant-work comparison; an empty, oversized or malformed input is simply `false`. */
export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
  if (plain === '' || !fits(plain)) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
};
