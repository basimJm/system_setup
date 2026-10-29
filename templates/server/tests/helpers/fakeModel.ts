import { Types, type Model } from 'mongoose';

type Doc = Record<string, unknown>;
type Filter = Record<string, unknown>;

const isOperatorObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !(value instanceof Date) &&
  !(value instanceof Types.ObjectId) &&
  Object.keys(value).some((key) => key.startsWith('$'));

const same = (a: unknown, b: unknown): boolean => String(a) === String(b);

const matchesCondition = (actual: unknown, condition: unknown): boolean => {
  if (!isOperatorObject(condition)) return same(actual, condition);
  return Object.entries(condition).every(([operator, expected]) => {
    switch (operator) {
      case '$ne':
        return !same(actual, expected);
      case '$in':
        return (expected as unknown[]).some((item) => same(actual, item));
      case '$nin':
        return !(expected as unknown[]).some((item) => same(actual, item));
      case '$exists':
        return (actual !== undefined && actual !== null) === expected;
      case '$gt':
        return (actual as number) > (expected as number);
      case '$gte':
        return (actual as number) >= (expected as number);
      case '$lt':
        return (actual as number) < (expected as number);
      case '$lte':
        return (actual as number) <= (expected as number);
      case '$regex':
        return new RegExp(
          String(expected),
          typeof condition['$options'] === 'string' ? condition['$options'] : '',
        ).test(String(actual));
      case '$geoWithin': {
        const [[lng, lat], radians] = (expected as { $centerSphere: [[number, number], number] })
          .$centerSphere;
        const point = (actual as { coordinates?: [number, number] } | undefined)?.coordinates;
        if (point === undefined) return false;
        const rad = (d: number): number => (d * Math.PI) / 180;
        const a =
          Math.sin(rad(point[1] - lat) / 2) ** 2 +
          Math.cos(rad(lat)) * Math.cos(rad(point[1])) * Math.sin(rad(point[0] - lng) / 2) ** 2;
        return 2 * Math.asin(Math.min(1, Math.sqrt(a))) <= radians;
      }
      case '$elemMatch':
        return (
          Array.isArray(actual) && actual.some((item) => matches(item as Doc, expected as Filter))
        );
      case '$options':
        return true;
      default:
        throw new Error(`fake model does not support ${operator}`);
    }
  });
};

/** `$set` like MongoDB: a dotted key writes into the nested document. */
const applySet = (doc: Doc, set: Doc): void => {
  for (const [path, value] of Object.entries(set)) {
    const parts = path.split('.');
    const last = parts.pop() ?? path;
    let target = doc;
    for (const part of parts) {
      const next = target[part];
      if (typeof next !== 'object' || next === null) target[part] = {};
      target = target[part] as Doc;
    }
    target[last] = value;
  }
};

/** Reads `a.b` from nested documents, like a MongoDB dotted path. */
const valueAt = (doc: Doc, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (value, part) =>
        typeof value === 'object' && value !== null ? (value as Doc)[part] : undefined,
      doc,
    );

export const matches = (doc: Doc, filter: Filter): boolean =>
  Object.entries(filter).every(([key, condition]) => {
    if (key === '$and') return (condition as Filter[]).every((part) => matches(doc, part));
    if (key === '$or') return (condition as Filter[]).some((part) => matches(doc, part));
    return matchesCondition(valueAt(doc, key), condition);
  });

class FakeQuery<T> implements PromiseLike<T> {
  private sortSpec: Record<string, 1 | -1> = {};
  private skipCount = 0;
  private limitCount = Infinity;

  constructor(private readonly run: (query: FakeQuery<T>) => T) {}

  sort(spec: Record<string, 1 | -1>): this {
    this.sortSpec = spec;
    return this;
  }
  skip(count: number): this {
    this.skipCount = count;
    return this;
  }
  limit(count: number): this {
    this.limitCount = count;
    return this;
  }
  lean(): this {
    return this;
  }
  exec(): Promise<T> {
    return Promise.resolve(this.run(this));
  }
  then<R1 = T, R2 = never>(
    onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  /** Applies sort, skip and limit to matching documents. */
  window(docs: Doc[]): Doc[] {
    const keys = Object.entries(this.sortSpec);
    const sorted = [...docs].sort((a, b) => {
      for (const [key, direction] of keys) {
        const first = valueAt(a, key);
        const second = valueAt(b, key);
        const left = String(first instanceof Date ? first.getTime() : first);
        const right = String(second instanceof Date ? second.getTime() : second);
        const numeric = typeof first === 'number' || first instanceof Date;
        const order = numeric
          ? Number(left) - Number(right)
          : left < right
            ? -1
            : left > right
              ? 1
              : 0;
        if (order !== 0) return order * direction;
      }
      return 0;
    });
    return sorted.slice(this.skipCount, this.skipCount + this.limitCount);
  }
}

export interface FakeModel {
  /** Cast for use where a Mongoose model is expected. */
  readonly model: Model<never>;
  readonly docs: Doc[];
  readonly calls: { filter: Filter }[];
}

/** In-memory stand-in for the subset of a Mongoose model that `BaseRepository` uses. */
export const createFakeModel = (initial: Doc[] = []): FakeModel => {
  const docs: Doc[] = initial.map((doc) => ({ _id: new Types.ObjectId(), __v: 0, ...doc }));
  const calls: { filter: Filter }[] = [];
  const select = (filter: Filter): Doc[] => {
    calls.push({ filter });
    return docs.filter((doc) => matches(doc, filter));
  };
  const model = {
    create: (data: Doc) => {
      const doc: Doc = {
        _id: new Types.ObjectId(),
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      docs.push(doc);
      return Promise.resolve({ toObject: () => ({ ...doc }) });
    },
    findOne: (filter: Filter) => new FakeQuery((q) => q.window(select(filter))[0] ?? null),
    find: (filter: Filter) => new FakeQuery((q) => q.window(select(filter))),
    countDocuments: (filter: Filter) => new FakeQuery(() => select(filter).length),
    exists: (filter: Filter) =>
      new FakeQuery(() => (select(filter)[0] ? { _id: select(filter)[0]?._id } : null)),
    findOneAndUpdate: (
      filter: Filter,
      update: {
        $set?: Doc;
        $unset?: Doc;
        $inc?: Record<string, number>;
        $push?: Doc;
        $max?: Doc;
      },
      options: { upsert?: boolean } = {},
    ) =>
      new FakeQuery(() => {
        let doc = select(filter)[0];
        if (!doc) {
          if (options.upsert !== true) return null;
          // Like MongoDB: a new document starts from the equality conditions of the filter.
          doc = {
            _id: new Types.ObjectId(),
            __v: 0,
            createdAt: new Date(),
            ...Object.fromEntries(
              Object.entries(filter).filter(
                ([key, condition]) => !key.startsWith('$') && !isOperatorObject(condition),
              ),
            ),
          };
          docs.push(doc);
        }
        applySet(doc, update.$set ?? {});
        doc['updatedAt'] = new Date();
        for (const [key, step] of Object.entries(update.$inc ?? {})) {
          applySet(doc, { [key]: Number(valueAt(doc, key) ?? 0) + step });
        }
        for (const [key, candidate] of Object.entries(update.$max ?? {})) {
          const current = valueAt(doc, key);
          if (current === undefined || (candidate as number) > (current as number)) {
            applySet(doc, { [key]: candidate });
          }
        }
        for (const [key, item] of Object.entries(update.$push ?? {})) {
          const current = valueAt(doc, key);
          applySet(doc, {
            [key]: [...(Array.isArray(current) ? (current as unknown[]) : []), item],
          });
        }
        for (const key of Object.keys(update.$unset ?? {})) Reflect.deleteProperty(doc, key);
        return { ...doc };
      }),
    aggregate: (pipeline: [{ $match: Filter }, { $group?: { sum?: { $sum?: unknown } } }]) =>
      new FakeQuery(() => {
        const found = select(pipeline[0].$match);
        // `{ $group: { sum: { $sum: '$field' } } }` sums that field (reviews: `rating`).
        const summed = pipeline[1].$group?.sum?.$sum;
        const field = typeof summed === 'string' ? summed.slice(1) : 'rating';
        return found.length === 0
          ? []
          : [
              {
                _id: null,
                sum: found.reduce((total, doc) => total + Number(doc[field]), 0),
                count: found.length,
              },
            ];
      }),
    deleteOne: (filter: Filter) =>
      new FakeQuery(() => {
        const index = docs.findIndex((doc) => matches(doc, filter));
        if (index >= 0) docs.splice(index, 1);
        return { deletedCount: index >= 0 ? 1 : 0 };
      }),
    updateMany: (filter: Filter, update: { $set?: Doc; $unset?: Doc }) =>
      new FakeQuery(() => {
        const found = select(filter);
        for (const doc of found) {
          applySet(doc, update.$set ?? {});
          doc['updatedAt'] = new Date();
          for (const key of Object.keys(update.$unset ?? {})) Reflect.deleteProperty(doc, key);
        }
        return { modifiedCount: found.length };
      }),
  };
  return { model: model as unknown as Model<never>, docs, calls };
};
