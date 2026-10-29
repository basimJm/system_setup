import type { Schema } from 'mongoose';
import {
  APPEND_ONLY_VIOLATION,
  MUTATING_DOCUMENT_OPERATIONS,
  MUTATING_QUERY_OPERATIONS,
} from '../constants/audit';

/** Thrown when code tries to change or remove a record of an append-only collection. */
export class AppendOnlyViolationError extends Error {
  constructor() {
    super(APPEND_ONLY_VIOLATION);
    this.name = 'AppendOnlyViolationError';
  }
}

const refuse = (): never => {
  throw new AppendOnlyViolationError();
};

/**
 * Makes a schema insert-only: every query, document and bulk operation that would update, replace
 * or delete a record throws (a programmer error, so it becomes a 500). This is the code-level
 * guarantee behind "append-only, never updated" (BUSINESS_DOMAIN.md §3.7); repositories also
 * expose no such method. Database-level protection (a role without update/delete) is an ops task.
 */
export const makeAppendOnly = (schema: Schema): void => {
  for (const operation of MUTATING_QUERY_OPERATIONS) schema.pre(operation, refuse);
  for (const operation of MUTATING_DOCUMENT_OPERATIONS) {
    schema.pre(operation, { document: true, query: false }, refuse);
  }
  schema.pre('bulkWrite', refuse);
  // Saving an already stored document would be an update.
  schema.pre('save', function guardSave() {
    if (!this.isNew) refuse();
  });
};
