import { z } from 'zod';

/**
 * A required instant in a request body: an ISO 8601 date-time with `Z` or an offset, parsed to a `Date`.
 * Unlike `z.coerce.date()` it rejects `null` (which coerces to 1970) and is documented as a
 * non-nullable `date-time` string.
 */
export const instantInput = z.iso.datetime({ offset: true }).pipe(z.coerce.date());
