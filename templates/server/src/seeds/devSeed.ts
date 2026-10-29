import { ADMIN_SEED_ENV } from '../constants/adminSeed';
import { DEV_SEED } from '../constants/devSeed';
import { ALL_MODELS } from '../models';
import {
  AdminsRepository,
  CustomersRepository,
  MembersRepository,
} from '../repositories/identity.repository';
import { ItemsRepository } from '../repositories/items.repository';
import { toObjectId } from '../utils/database/ids';
import { ensureIndexes } from '../utils/database/indexes';
import type { Logger } from '../utils/logger';
import { seedAdmin } from './admin';

/** What the admin part did: made one from the env, found one, or had neither. */
export type DevSeedAdmin = 'created' | 'existing' | 'skipped';

export interface DevSeedReport {
  readonly admin: DevSeedAdmin;
  readonly customer: 'created' | 'existing';
  readonly merchant: 'created' | 'existing';
  readonly items: { created: number; existing: number };
}

export interface DevSeedDeps {
  readonly logger: Logger;
  /** Where `ADMIN_EMAIL` / `ADMIN_PASSWORD` are read (never logged). */
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly repositories?: {
    readonly admins: AdminsRepository;
    readonly customers: CustomersRepository;
    readonly members: MembersRepository;
    readonly items: ItemsRepository;
  };
}

/** The admin from the env when there is none yet; an existing admin is never touched. */
const ensureAdmin = async (
  admins: AdminsRepository,
  env: DevSeedDeps['env'],
): Promise<DevSeedAdmin> => {
  if ((await admins.count({})) > 0) return 'existing';
  const email = env[ADMIN_SEED_ENV.email];
  const password = env[ADMIN_SEED_ENV.password];
  if (email === undefined || password === undefined) return 'skipped';
  await seedAdmin({ admins, email, password });
  return 'created';
};

/**
 * `seed:dev` (development data only): the admin from the env, one demo customer, one demo merchant
 * owner and a few items for each. Insert-only and idempotent: a second run changes nothing.
 */
export const seedDev = async (deps: DevSeedDeps): Promise<DevSeedReport> => {
  const repos = deps.repositories ?? {
    admins: new AdminsRepository(),
    customers: new CustomersRepository(),
    members: new MembersRepository(),
    items: new ItemsRepository(),
  };
  const admin = await ensureAdmin(repos.admins, deps.env);
  if (admin === 'skipped') {
    deps.logger.warn(
      `admin skipped: set ${ADMIN_SEED_ENV.email} and ${ADMIN_SEED_ENV.password}, or run \`npm run seed:admin\``,
    );
  }
  const customer = await repos.customers.insertIfMissing(
    { phone: DEV_SEED.customer.phone },
    { ...DEV_SEED.customer, status: 'ACTIVE' },
  );
  let merchant = await repos.members.findByPhone(DEV_SEED.merchant.phone);
  const merchantCreated = merchant === null;
  merchant ??= await repos.members.createOwner({ ...DEV_SEED.merchant, active: true });
  const items = { created: 0, existing: 0 };
  const owners = [
    { type: 'CUSTOMER' as const, id: customer.entity.id },
    { type: 'MERCHANT' as const, id: merchant.tenantId },
  ];
  for (const owner of owners) {
    for (const item of DEV_SEED.items) {
      const result = await repos.items.insertIfMissing(
        { ownerType: owner.type, ownerId: toObjectId(owner.id), title: item.title },
        {
          ownerType: owner.type,
          ownerId: toObjectId(owner.id),
          title: item.title,
          description: item.description,
          tags: [...item.tags],
          status: 'ACTIVE',
        },
      );
      items[result.created ? 'created' : 'existing'] += 1;
    }
  }
  return {
    admin,
    customer: customer.created ? 'created' : 'existing',
    merchant: merchantCreated ? 'created' : 'existing',
    items,
  };
};

/** Indexes first, then the data. */
export const seedDevWithIndexes = async (deps: DevSeedDeps): Promise<DevSeedReport> => {
  await ensureIndexes(ALL_MODELS, deps.logger);
  return seedDev(deps);
};
