import { loadConfig } from '../config';
import { ALL_MODELS } from '../models';
import { connectMongo, disconnectMongo } from '../utils/database/connection';
import { ensureIndexes } from '../utils/database/indexes';
import { createLogger } from '../utils/logger';

/**
 * `npm run seed`: creates the indexes (production runs with `autoIndex: false`). Reference data
 * that every environment needs (lookup tables...) is inserted here, insert-only, as it is added.
 */
const main = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  await connectMongo(config, logger);
  try {
    await ensureIndexes(ALL_MODELS, logger);
    logger.info('indexes and reference data ready');
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
