import type { AppConfig } from '../config';
import type { Logger } from '../utils/logger';
import { seedDev } from './devSeed';

/** `SEED_DEV_ON_START=true`: the dev seed runs after startup, in the background, and never throws. */
export const seedDevOnStart = async (deps: {
  readonly config: Pick<AppConfig, 'isProduction'>;
  readonly logger: Logger;
  readonly env: Readonly<Record<string, string | undefined>>;
}): Promise<void> => {
  if (deps.config.isProduction) {
    deps.logger.warn('dev seed skipped: production rules');
    return;
  }
  try {
    deps.logger.info(await seedDev({ logger: deps.logger, env: deps.env }), 'dev seed finished');
  } catch (error) {
    deps.logger.error({ err: error }, 'dev seed failed');
  }
};
