import { z } from 'zod';
import { FIRST_PAGE, MAX_PAGE, MAX_PAGE_SIZE } from '../../constants/pagination';

export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginationMeta extends PaginationParams {
  readonly total: number;
}

/**
 * Query schema for `?page=&pageSize=`. Values are coerced from strings; out-of-range values are
 * rejected (400) rather than silently changed. The default page size comes from settings/constants.
 */
export const paginationQuery = (
  defaultPageSize: number,
): z.ZodObject<{
  page: z.ZodDefault<z.ZodCoercedNumber>;
  pageSize: z.ZodDefault<z.ZodCoercedNumber>;
}> =>
  z.object({
    page: z.coerce.number().int().min(FIRST_PAGE).max(MAX_PAGE).default(FIRST_PAGE),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(defaultPageSize),
  });

/** Offset/limit for a repository query. */
export const toSkipLimit = ({
  page,
  pageSize,
}: PaginationParams): { skip: number; limit: number } => ({
  skip: (page - FIRST_PAGE) * pageSize,
  limit: pageSize,
});

export const buildPaginationMeta = (params: PaginationParams, total: number): PaginationMeta => ({
  page: params.page,
  pageSize: params.pageSize,
  total,
});
