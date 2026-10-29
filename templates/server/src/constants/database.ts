/** MongoDB connection and repository constants. */
export const MONGO_SERVER_SELECTION_TIMEOUT_MS = 5_000;
export const MONGO_CONNECT_TIMEOUT_MS = 10_000;
export const MONGO_SOCKET_TIMEOUT_MS = 45_000;
export const MONGO_MAX_POOL_SIZE = 20;
export const MONGO_MIN_POOL_SIZE = 2;

/** No regex flags: the OpenAPI generator copies `toString()`, so a flag would leak into `pattern`. */
export const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
export const MONGO_READINESS_CHECK_NAME = 'mongodb';

export const SORT_ASCENDING = 1;
export const SORT_DESCENDING = -1;
export const DEFAULT_SORT = { createdAt: SORT_DESCENDING } as const;

/**
 * Indexes a schema no longer declares and that must go before the new ones can be created (one
 * text index per collection), by model name. Dropping is idempotent and runs at every start.
 */
export const RETIRED_INDEXES: Readonly<Record<string, readonly string[]>> = {};
/** Server codes for "nothing to drop": the index or the whole collection does not exist yet. */
export const MONGO_INDEX_NOT_FOUND_CODES: readonly number[] = [26, 27];
