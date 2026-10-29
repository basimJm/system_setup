import { MONGO_INDEX_NOT_FOUND_CODES, RETIRED_INDEXES } from '../../constants/database';
import type { Logger } from '../logger';

/** The part of a Mongoose model that index creation needs. */
export interface IndexedModel {
  readonly modelName: string;
  createIndexes(): Promise<unknown>;
  readonly collection?: { dropIndex(name: string): Promise<unknown> };
}

const isNotFound = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' && MONGO_INDEX_NOT_FOUND_CODES.includes(code);
};

/** Drops the indexes a model retired; an index (or collection) that is already gone is fine. */
const dropRetired = async (
  model: IndexedModel,
  retired: readonly string[],
  logger: Logger,
): Promise<void> => {
  for (const name of retired) {
    try {
      await model.collection?.dropIndex(name);
      logger.info({ model: model.modelName, index: name }, 'retired index dropped');
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
};

/**
 * Creates the indexes the schemas declare. Production runs with `autoIndex: false`, so without
 * this the unique keys would not exist. It only creates what is missing: `createIndexes` never
 * drops or changes an index; the only drops are the named `RETIRED_INDEXES` (gone after the first
 * run), so running it on every start and from several instances at once is safe. A failure names the model and stops start-up, because a missing unique index is a
 * correctness problem.
 */
export const ensureIndexes = async (
  models: readonly IndexedModel[],
  logger: Logger,
  retired: Readonly<Record<string, readonly string[]>> = RETIRED_INDEXES,
): Promise<void> => {
  for (const model of models) {
    try {
      await dropRetired(model, retired[model.modelName] ?? [], logger);
      await model.createIndexes();
    } catch (error) {
      logger.error({ err: error, model: model.modelName }, 'creating indexes failed');
      throw error;
    }
    logger.info({ model: model.modelName }, 'indexes ready');
  }
};
