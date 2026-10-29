import { Types } from 'mongoose';
import { OBJECT_ID_PATTERN } from '../../constants/database';
import { ValidationError } from '../errors';

/** Is `value` a 24-character hex string, i.e. a possible ObjectId? Use it in request schemas. */
export const isObjectIdString = (value: unknown): value is string =>
  typeof value === 'string' && OBJECT_ID_PATTERN.test(value);

/** A fresh id as a string. */
export const newId = (): string => new Types.ObjectId().toHexString();

/** String → `ObjectId` for queries that need one; a malformed id is a client error (400). */
export const toObjectId = (value: string): Types.ObjectId => {
  if (!isObjectIdString(value)) throw new ValidationError();
  return new Types.ObjectId(value);
};
