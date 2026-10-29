import { loadConfig } from '../config';
import { connectMongo, disconnectMongo } from '../utils/database/connection';
import { createLogger } from '../utils/logger';
import { seedDevWithIndexes } from './devSeed';

/** `npm run seed:dev`: fills a development database in one run. Refused under production rules. */
const main = async (): Promise<void> => {
  const config = loadConfig();
  if (config.isProduction) throw new Error('seed:dev is for development databases only');
  const logger = createLogger({ level: config.logLevel });
  await connectMongo(config, logger);
  try {
    const report = await seedDevWithIndexes({ logger, env: process.env });
    process.stdout.write(`${JSON.stringify(report)}\n`);
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
