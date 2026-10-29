import { Types } from 'mongoose';

/** Mongoose ids/references become strings; everything else keeps its type. */
export type Plain<T> = T extends Types.ObjectId
  ? string
  : T extends Date
    ? Date
    : T extends readonly (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T;

/** A stored document as the rest of the app sees it: string `id`, no `_id` / `__v`. */
export type Entity<TRaw> = { id: string } & Plain<Omit<TRaw, '_id' | '__v'>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const convert = (value: unknown): unknown => {
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(convert);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, convert(child)]));
  }
  return value;
};

/** Turns a lean Mongoose document into a plain entity. Idempotent for already-plain values. */
export const toEntity = <TRaw>(document: unknown): Entity<TRaw> => {
  const { _id, ...rest } = document as Record<string, unknown>;
  delete rest['__v'];
  return { id: String(_id), ...(convert(rest) as Record<string, unknown>) } as Entity<TRaw>;
};
