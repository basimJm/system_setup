import { PASSWORD_MAX_BYTES } from '../src/constants/adminAuth';
import { hashPassword, verifyPassword } from '../src/utils/auth/password';

const COST = 4;

describe('password hashing', () => {
  it('hashes with bcrypt, differently each time, and verifies', async () => {
    const first = await hashPassword('s3cret pass', COST);
    const second = await hashPassword('s3cret pass', COST);
    expect(first).toMatch(/^\$2[aby]\$04\$/);
    expect(first).not.toBe(second);
    await expect(verifyPassword('s3cret pass', first)).resolves.toBe(true);
    await expect(verifyPassword('s3cret pass', second)).resolves.toBe(true);
  });

  it('rejects a wrong password, including a near miss and different case', async () => {
    const hash = await hashPassword('s3cret pass', COST);
    await expect(verifyPassword('s3cret pas', hash)).resolves.toBe(false);
    await expect(verifyPassword('S3CRET PASS', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('treats a malformed hash as a mismatch, never an error', async () => {
    await expect(verifyPassword('s3cret pass', 'not a hash')).resolves.toBe(false);
    await expect(verifyPassword('s3cret pass', '')).resolves.toBe(false);
  });

  it('refuses to hash an empty or oversized password (bcrypt would truncate it)', async () => {
    await expect(hashPassword('', COST)).rejects.toBeInstanceOf(RangeError);
    const longest = 'a'.repeat(PASSWORD_MAX_BYTES);
    await expect(hashPassword(longest, COST)).resolves.toBeDefined();
    await expect(hashPassword(`${longest}a`, COST)).rejects.toBeInstanceOf(RangeError);
    // multi-byte characters count by bytes, not characters
    await expect(hashPassword('é'.repeat(PASSWORD_MAX_BYTES / 2 + 1), COST)).rejects.toBeInstanceOf(
      RangeError,
    );
    const hash = await hashPassword(longest, COST);
    await expect(verifyPassword(`${longest}a`, hash)).resolves.toBe(false);
  });

  it('verifies non-ASCII passwords', async () => {
    const hash = await hashPassword('كلمة سر قوية', COST);
    await expect(verifyPassword('كلمة سر قوية', hash)).resolves.toBe(true);
    await expect(verifyPassword('كلمة سر', hash)).resolves.toBe(false);
  });
});
