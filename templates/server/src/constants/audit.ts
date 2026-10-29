/** Audit log and server-event constants (docs/BUSINESS_DOMAIN.md §3.7). */
export const AUDIT_LOGS_COLLECTION = 'auditLogs';
export const SERVER_EVENTS_COLLECTION = 'serverEvents';

/** `ITEM_ARCHIVE`, `SETTING_UPDATE`: upper-case words joined by `_`. */
export const AUDIT_ACTION_PATTERN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
/** `item.created`, `otp.verified`: lower-case words, digits and `_`, joined by dots. */
export const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export const AUDIT_ACTION_MAX_LENGTH = 80;
export const AUDIT_ENTITY_TYPE_MAX_LENGTH = 60;
export const AUDIT_ENTITY_ID_MAX_LENGTH = 64;
export const AUDIT_REASON_MAX_LENGTH = 1_000;
export const AUDIT_REASON_MIN_LENGTH = 3;
export const AUDIT_IP_MAX_LENGTH = 64;
export const AUDIT_USER_AGENT_MAX_LENGTH = 512;
/** Stored when a client sends no User-Agent (the schema wants a non-empty value). */
export const AUDIT_UNKNOWN_USER_AGENT = 'unknown';
export const AUDIT_ROUTES = { base: '/audit-logs' } as const;

export const EVENT_NAME_MAX_LENGTH = 80;
export const EVENT_APP_VERSION_MAX_LENGTH = 32;

/** Mongoose operations that would change or remove a stored record; append-only models refuse them. */
export const MUTATING_QUERY_OPERATIONS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const;
export const MUTATING_DOCUMENT_OPERATIONS = ['updateOne', 'deleteOne'] as const;

export const APPEND_ONLY_VIOLATION = 'append-only collection: records cannot be changed or removed';
