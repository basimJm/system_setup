import { loadConfig } from '../config';
import { ADMIN_SEED_ENV } from '../constants/adminSeed';
import { ALL_MODELS } from '../models';
import { AdminsRepository } from '../repositories/identity.repository';
import { connectMongo, disconnectMongo } from '../utils/database/connection';
import { ensureIndexes } from '../utils/database/indexes';
import { createLogger } from '../utils/logger';
import { seedAdmin } from './admin';

/** `npm run seed:admin`: creates the first admin from ADMIN_EMAIL + ADMIN_PASSWORD (never logged). */
const main = async (): Promise<void> => {
  const email = process.env[ADMIN_SEED_ENV.email] ?? '';
  const password = process.env[ADMIN_SEED_ENV.password] ?? '';
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  await connectMongo(config, logger);
  try {
    await ensureIndexes(ALL_MODELS, logger);
    const created = await seedAdmin({ admins: new AdminsRepository(), email, password });
    logger.info({ email: created.email }, 'admin created');
  } finally {
    await disconnectMongo();
  }
};

if (require.main === module) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
