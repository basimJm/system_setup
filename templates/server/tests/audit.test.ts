import { Types, type Model } from 'mongoose';
import { createAuditWriter } from '../src/domain/audit';
import { createServerEvents } from '../src/domain/events';
import { ALL_MODELS } from '../src/models';
import { AppendOnlyViolationError } from '../src/models/appendOnly';
import { AuditLogModel, type AuditLogRaw } from '../src/models/auditLog.model';
import { ServerEventModel, type ServerEventRaw } from '../src/models/serverEvent.model';
import { AuditLogsRepository } from '../src/repositories/auditLogs.repository';
import { ServerEventsRepository } from '../src/repositories/serverEvents.repository';
import { normalizeError } from '../src/utils/errors/normalize';
import { ValidationError } from '../src/utils/errors';
import { createFakeModel } from './helpers/fakeModel';

const adminId = new Types.ObjectId().toHexString();
const entry = {
  adminId,
  action: 'ITEM_ARCHIVE',
  entityType: 'item',
  entityId: new Types.ObjectId().toHexString(),
  before: { state: 'LIVE' },
  after: { state: 'OFFLINE' },
  reason: 'Reported by several users',
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0',
};

const withoutSnapshots = (value: typeof entry): Omit<typeof entry, 'before' | 'after'> =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'before' && key !== 'after'),
  ) as Omit<typeof entry, 'before' | 'after'>;

const failingFields = async (
  model: { new (data: object): { validate(): Promise<unknown> } },
  data: object,
): Promise<string[]> => {
  try {
    await new model(data).validate();
    return [];
  } catch (error) {
    return Object.keys((error as { errors?: Record<string, unknown> }).errors ?? {}).sort();
  }
};

/** Written out here, not imported, so removing one from the source list fails the test. */
const MUTATING_QUERY_OPERATIONS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const;

describe('append-only models', () => {
  const models = [AuditLogModel, ServerEventModel] as unknown as Model<never>[];

  it('are registered for index creation', () => {
    expect(ALL_MODELS).toContain(AuditLogModel);
    expect(ALL_MODELS).toContain(ServerEventModel);
  });

  it.each(MUTATING_QUERY_OPERATIONS)('refuse the query operation %s', async (operation) => {
    for (const model of models) {
      const run = (model as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[
        operation
      ];
      const call = /^(update|findOneAndUpdate)/.test(operation)
        ? run?.call(model, {}, { $set: { reason: 'x' } })
        : /replace/i.test(operation)
          ? run?.call(model, {}, { reason: 'x' })
          : run?.call(model, {});
      await expect(call).rejects.toBeInstanceOf(AppendOnlyViolationError);
    }
  });

  it('refuse bulk writes, document deletes and re-saving a stored document', async () => {
    for (const model of models) {
      await expect(
        model.bulkWrite([{ deleteOne: { filter: {} } }] as never),
      ).rejects.toBeInstanceOf(AppendOnlyViolationError);
    }
    const log = new AuditLogModel(entry);
    await expect(log.deleteOne()).rejects.toBeInstanceOf(AppendOnlyViolationError);
    await expect(log.updateOne({ $set: { reason: 'x' } })).rejects.toBeInstanceOf(
      AppendOnlyViolationError,
    );
    log.isNew = false;
    await expect(log.save()).rejects.toBeInstanceOf(AppendOnlyViolationError);
  });

  it('report a violation as a server fault, not a client error', () => {
    expect(normalizeError(new AppendOnlyViolationError()).httpStatus).toBe(500);
  });
});

describe('audit log model', () => {
  const model = AuditLogModel;

  it('accepts a full entry and keeps only a creation time', async () => {
    expect(await failingFields(model, entry)).toEqual([]);
    expect(AuditLogModel.schema.get('timestamps')).toEqual({ createdAt: true, updatedAt: false });
    expect(AuditLogModel.collection.name).toBe('auditLogs');
  });

  it('does not require before / after', async () => {
    const minimal = withoutSnapshots(entry);
    expect(await failingFields(model, minimal)).toEqual([]);
  });

  it('requires every other field', async () => {
    expect(await failingFields(model, {})).toEqual([
      'action',
      'adminId',
      'entityId',
      'entityType',
      'ip',
      'reason',
      'userAgent',
    ]);
  });

  it.each(['item_archive', 'Item', '1ACTION', 'A__B', ''])('rejects action %j', async (action) => {
    expect(await failingFields(model, { ...entry, action })).toContain('action');
  });

  it('indexes by admin, by entity and by action, newest first', () => {
    expect(AuditLogModel.schema.indexes().map(([keys]) => keys)).toEqual([
      { adminId: 1, createdAt: -1 },
      { entityType: 1, entityId: 1, createdAt: -1 },
      { action: 1, createdAt: -1 },
      { createdAt: -1 },
    ]);
  });
});

describe('server event model', () => {
  const model = ServerEventModel;
  const event = { name: 'otp.requested', actorType: 'CUSTOMER' };

  it('needs only a name and an actor type', async () => {
    expect(await failingFields(model, event)).toEqual([]);
    expect(await failingFields(model, {})).toEqual(['actorType', 'name']);
    expect(ServerEventModel.collection.name).toBe('serverEvents');
  });

  it.each([{ actorType: 'ROBOT' }, { platform: 'WINDOWS' }, { name: 'OTP' }, { name: 'a..b' }])(
    'rejects %j',
    async (override) => {
      expect(await failingFields(model, { ...event, ...override })).not.toEqual([]);
    },
  );

  it('defaults params to {} and ts to now', () => {
    const doc = new ServerEventModel(event);
    expect(doc.params).toEqual({});
    expect(doc.ts).toBeInstanceOf(Date);
  });
});

describe('append-only repositories', () => {
  it('expose append and reads, and nothing that changes records', () => {
    for (const repository of [
      new AuditLogsRepository(createFakeModel().model as unknown as Model<AuditLogRaw>),
      new ServerEventsRepository(createFakeModel().model as unknown as Model<ServerEventRaw>),
    ]) {
      const methods = new Set([
        ...Object.getOwnPropertyNames(Object.getPrototypeOf(repository)),
        ...Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(repository))),
      ]);
      // `countGrouped` is a read-only aggregate on the server events (dashboards).
      const allowed = ['append', 'findById', 'findPage'];
      // Server events also have read-only counts (analytics, merchant statistics).
      if (repository instanceof ServerEventsRepository) allowed.splice(1, 0, 'countGrouped');
      expect([...methods].filter((name) => name !== 'constructor').sort()).toEqual(allowed);
    }
  });

  it('stores an entry, finds it by id and pages the list newest first', async () => {
    const fake = createFakeModel();
    const repository = new AuditLogsRepository(fake.model as unknown as Model<AuditLogRaw>);
    const first = await repository.append({ action: 'A' });
    await repository.append({ action: 'B' });
    expect(await repository.findById(first.id)).toMatchObject({ id: first.id, action: 'A' });
    expect(await repository.findById('not-an-id')).toBeNull();
    expect(await repository.findById(new Types.ObjectId().toHexString())).toBeNull();
    const page = await repository.findPage({}, { page: 1, pageSize: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.meta).toEqual({ page: 1, pageSize: 1, total: 2 });
  });
});

describe('audit writer', () => {
  const setup = (): { writer: ReturnType<typeof createAuditWriter>; stored: object[] } => {
    const stored: object[] = [];
    const writer = createAuditWriter({
      append: (data) => {
        stored.push(data);
        return Promise.resolve({ id: 'x', ...data } as never);
      },
    });
    return { writer, stored };
  };

  it('stores a valid entry with before and after', async () => {
    const { writer, stored } = setup();
    await writer.record(entry);
    expect(stored).toEqual([entry]);
  });

  it('omits before / after when not given and trims text', async () => {
    const { writer, stored } = setup();
    const rest = withoutSnapshots(entry);
    await writer.record({ ...rest, reason: '  Duplicate account  ' });
    expect(stored[0]).toEqual({ ...rest, reason: 'Duplicate account' });
    expect(stored[0]).not.toHaveProperty('before');
  });

  it.each([
    ['empty reason', { reason: '' }],
    ['blank reason', { reason: '   ' }],
    ['missing reason', { reason: undefined }],
    ['bad admin id', { adminId: 'abc' }],
    ['lower-case action', { action: 'item_archive' }],
    ['empty entity id', { entityId: '' }],
    ['missing ip', { ip: undefined }],
    ['oversize reason', { reason: 'x'.repeat(1001) }],
  ])('rejects %s with a 400 and stores nothing', async (_label, override) => {
    const { writer, stored } = setup();
    const failure = await writer
      .record({ ...entry, ...override } as never)
      .catch((error: unknown) => error);
    expect(normalizeError(failure)).toBeInstanceOf(ValidationError);
    expect(stored).toHaveLength(0);
  });

  it('lets a storage failure reach the caller', async () => {
    const boom = new Error('db down');
    const writer = createAuditWriter({ append: () => Promise.reject(boom) });
    await expect(writer.record(entry)).rejects.toBe(boom);
  });
});

describe('server events', () => {
  const logger = (): { warn: jest.Mock; error: jest.Mock } => ({
    warn: jest.fn(),
    error: jest.fn(),
  });
  const when = new Date('2026-10-12T10:00:00.000Z');

  it('stores a valid event with the clock time and redacted params', async () => {
    const stored: Record<string, unknown>[] = [];
    const log = logger();
    const events = createServerEvents({
      store: { append: (data) => Promise.resolve(void stored.push(data)) },
      logger: log as never,
      now: () => when,
    });
    const ok = await events.track({
      name: 'otp.verified',
      actorType: 'CUSTOMER',
      params: { otp: '123456', result: 'ok' },
    });
    expect(ok).toBe(true);
    expect(stored[0]).toMatchObject({ name: 'otp.verified', ts: when });
    expect(JSON.stringify(stored[0])).not.toContain('123456');
    expect(stored[0]?.['params']).toMatchObject({ result: 'ok' });
  });

  it('defaults params to an empty object', async () => {
    const stored: Record<string, unknown>[] = [];
    const events = createServerEvents({
      store: { append: (data) => Promise.resolve(void stored.push(data)) },
      logger: logger() as never,
    });
    await events.track({ name: 'job.run', actorType: 'SYSTEM' });
    expect(stored[0]?.['params']).toEqual({});
  });

  it('never throws: an invalid event is dropped and logged', async () => {
    const store = { append: jest.fn() };
    const log = logger();
    const events = createServerEvents({ store, logger: log as never });
    const result = await events.track({ name: 'Bad Name', actorType: 'SYSTEM' });
    expect(result).toBe(false);
    expect(store.append).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it('never throws: a storage failure is logged and reported as false', async () => {
    const log = logger();
    const events = createServerEvents({
      store: { append: () => Promise.reject(new Error('db down')) },
      logger: log as never,
    });
    await expect(events.track({ name: 'job.run', actorType: 'SYSTEM' })).resolves.toBe(false);
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
