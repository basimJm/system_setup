import { DEV_SEED } from '../src/constants/devSeed';
import {
  AdminsRepository,
  CustomersRepository,
  MembersRepository,
} from '../src/repositories/identity.repository';
import { ItemsRepository } from '../src/repositories/items.repository';
import { seedAdmin } from '../src/seeds/admin';
import { seedDev } from '../src/seeds/devSeed';
import { createLogger } from '../src/utils/logger';
import { createFakeModel } from './helpers/fakeModel';

const logger = createLogger({ level: 'silent' });
const hash = (plain: string): Promise<string> => Promise.resolve(`hashed:${String(plain.length)}`);

const repositories = (): NonNullable<Parameters<typeof seedDev>[0]['repositories']> => ({
  admins: new AdminsRepository(createFakeModel().model as never),
  customers: new CustomersRepository(createFakeModel().model as never),
  members: new MembersRepository(createFakeModel().model as never),
  items: new ItemsRepository(createFakeModel().model as never),
});

describe('seedAdmin', () => {
  it('creates one admin from the env and refuses weak input or a second admin', async () => {
    const admins = new AdminsRepository(createFakeModel().model as never);
    await expect(
      seedAdmin({ admins, email: 'nope', password: 'x'.repeat(12), hash }),
    ).rejects.toThrow('email');
    await expect(seedAdmin({ admins, email: 'a@b.co', password: 'short', hash })).rejects.toThrow(
      'password',
    );
    await expect(
      seedAdmin({ admins, email: ' A@B.co ', password: 'x'.repeat(12), hash }),
    ).resolves.toEqual({ email: 'a@b.co' });
    await expect(
      seedAdmin({ admins, email: 'c@d.co', password: 'x'.repeat(12), hash }),
    ).rejects.toThrow('already');
  });
});

describe('seedDev', () => {
  it('is idempotent: a second run creates nothing, and the admin comes from the env only', async () => {
    const repos = repositories();
    const first = await seedDev({ logger, env: {}, repositories: repos });
    expect(first).toEqual({
      admin: 'skipped',
      customer: 'created',
      merchant: 'created',
      items: { created: DEV_SEED.items.length * 2, existing: 0 },
    });
    const owner = await repos.members.findByPhone(DEV_SEED.merchant.phone);
    expect(owner).toMatchObject({ role: 'OWNER', tenantId: owner?.id });
    const second = await seedDev({ logger, env: {}, repositories: repos });
    expect(second).toMatchObject({
      customer: 'existing',
      merchant: 'existing',
      items: { created: 0, existing: DEV_SEED.items.length * 2 },
    });
  });
});
