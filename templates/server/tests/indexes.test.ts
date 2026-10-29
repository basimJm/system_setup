import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_MODELS } from '../src/models';
import {} from '../src/constants/identity';
import { SettingModel } from '../src/models/setting.model';
import { ensureIndexes, type IndexedModel } from '../src/utils/database/indexes';
import type { Logger } from '../src/utils/logger';

const logger = (): { logger: Logger; info: jest.Mock; error: jest.Mock } => {
  const info = jest.fn();
  const error = jest.fn();
  return { logger: { info, error } as unknown as Logger, info, error };
};

const fakeModel = (modelName: string, calls: string[], failure?: Error): IndexedModel => ({
  modelName,
  createIndexes: () => {
    calls.push(modelName);
    return failure === undefined ? Promise.resolve([]) : Promise.reject(failure);
  },
});

describe('model registry', () => {
  it('lists every *.model.ts file, so no model is left without its indexes', () => {
    const files = readdirSync(join(__dirname, '../src/models')).filter((f) =>
      f.endsWith('.model.ts'),
    );
    expect(ALL_MODELS).toHaveLength(files.length);
    expect(ALL_MODELS).toContain(SettingModel);
  });

  it('only holds models that can create indexes', () => {
    for (const model of ALL_MODELS) {
      expect(typeof model.createIndexes).toBe('function');
      expect(model.modelName).toEqual(expect.any(String));
    }
  });
});

describe('ensureIndexes', () => {
  it('creates the indexes of every model, one after the other, and logs each', async () => {
    const calls: string[] = [];
    const { logger: log, info } = logger();
    await ensureIndexes([fakeModel('A', calls), fakeModel('B', calls)], log);
    expect(calls).toEqual(['A', 'B']);
    expect(info).toHaveBeenCalledWith({ model: 'A' }, 'indexes ready');
    expect(info).toHaveBeenCalledWith({ model: 'B' }, 'indexes ready');
  });

  it('does nothing for an empty list', async () => {
    await expect(ensureIndexes([], logger().logger)).resolves.toBeUndefined();
  });

  it('stops at the first failure, names the model and rethrows the original error', async () => {
    const calls: string[] = [];
    const boom = new Error('not authorized');
    const { logger: log, error } = logger();
    await expect(
      ensureIndexes(
        [fakeModel('A', calls), fakeModel('B', calls, boom), fakeModel('C', calls)],
        log,
      ),
    ).rejects.toBe(boom);
    expect(calls).toEqual(['A', 'B']);
    expect(error).toHaveBeenCalledWith({ err: boom, model: 'B' }, 'creating indexes failed');
  });

  it('is safe to run twice (it only calls createIndexes)', async () => {
    const calls: string[] = [];
    const { logger: log } = logger();
    await ensureIndexes([fakeModel('A', calls)], log);
    await ensureIndexes([fakeModel('A', calls)], log);
    expect(calls).toEqual(['A', 'A']);
  });
});

describe('text indexes', () => {
  /** MongoDB reads this field of each row as its text-search language unless told otherwise. */
  const DEFAULT_LANGUAGE_OVERRIDE = 'language';

  it('never read a stored field as the text-search language (a customer with language "ar" could not be saved)', () => {
    for (const model of ALL_MODELS) {
      for (const [fields, options] of model.schema.indexes()) {
        if (!Object.values(fields).includes('text')) continue;
        const override =
          (options as { language_override?: string }).language_override ??
          DEFAULT_LANGUAGE_OVERRIDE;
        expect([model.modelName, Object.hasOwn(model.schema.paths, override)]).toEqual([
          model.modelName,
          false,
        ]);
      }
    }
  });
});

describe('ensureIndexes with retired indexes', () => {
  const retiringModel = (calls: string[], dropError?: Error): IndexedModel => ({
    modelName: 'Customer',
    collection: {
      dropIndex: (name) => {
        calls.push(`drop:${name}`);
        return dropError === undefined ? Promise.resolve(true) : Promise.reject(dropError);
      },
    },
    createIndexes: () => {
      calls.push('create');
      return Promise.resolve([]);
    },
  });
  const retired = { Customer: ['old_text'] };

  it('drops the retired index before creating the new ones, and logs it', async () => {
    const calls: string[] = [];
    const { logger: log, info } = logger();
    await ensureIndexes([retiringModel(calls)], log, retired);
    expect(calls).toEqual(['drop:old_text', 'create']);
    expect(info).toHaveBeenCalledWith(
      { model: 'Customer', index: 'old_text' },
      'retired index dropped',
    );
  });

  it.each([
    ['index not found', 27],
    ['collection not created yet', 26],
  ])('carries on when there is nothing to drop (%s)', async (_label, code) => {
    const calls: string[] = [];
    await ensureIndexes(
      [retiringModel(calls, Object.assign(new Error('gone'), { code }))],
      logger().logger,
      retired,
    );
    expect(calls).toEqual(['drop:old_text', 'create']);
  });

  it('stops start-up on any other drop failure', async () => {
    const calls: string[] = [];
    const denied = Object.assign(new Error('not authorized'), { code: 13 });
    const { logger: log, error } = logger();
    await expect(ensureIndexes([retiringModel(calls, denied)], log, retired)).rejects.toBe(denied);
    expect(calls).toEqual(['drop:old_text']);
    expect(error).toHaveBeenCalledWith(
      { err: denied, model: 'Customer' },
      'creating indexes failed',
    );
  });

  it('leaves models without retired indexes alone', async () => {
    const calls: string[] = [];
    await ensureIndexes([fakeModel('Item', calls)], logger().logger, retired);
    expect(calls).toEqual(['Item']);
  });
});
