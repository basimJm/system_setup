import { ADMIN_SEED_MIN_PASSWORD_LENGTH } from '../constants/adminSeed';
import { EMAIL_PATTERN } from '../constants/providers';
import type { AdminsRepository } from '../repositories/identity.repository';
import { hashPassword } from '../utils/auth/password';

export interface SeedAdminInput {
  readonly admins: Pick<AdminsRepository, 'count' | 'create'>;
  readonly email: string;
  readonly password: string;
  /** Overridable so tests can use a cheap bcrypt cost. */
  readonly hash?: (plain: string) => Promise<string>;
}

/** Creates the single platform admin. Refuses when any admin exists, so it can never overwrite one. */
export const seedAdmin = async ({
  admins,
  email,
  password,
  hash = hashPassword,
}: SeedAdminInput): Promise<{ email: string }> => {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) throw new Error('the admin email is not valid');
  if (password.length < ADMIN_SEED_MIN_PASSWORD_LENGTH) {
    throw new Error(
      `the admin password needs at least ${String(ADMIN_SEED_MIN_PASSWORD_LENGTH)} characters`,
    );
  }
  if ((await admins.count({})) > 0) throw new Error('an admin already exists');
  await admins.create({ email: normalized, passwordHash: await hash(password), alertEmails: [] });
  return { email: normalized };
};
