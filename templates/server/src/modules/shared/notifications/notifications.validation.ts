import { z } from 'zod';
import { OBJECT_ID_PATTERN } from '../../../constants/database';
import { INBOX_SEARCH_MAX_LENGTH, MAX_READ_IDS } from '../../../constants/notifications';
import { APP_PAGE_SIZE } from '../../../constants/pagination';
import { paginationQuery } from '../../../utils/pagination';
import { isLocalDate } from '../../../utils/time';

const civilDate = z.string().refine(isLocalDate, 'YYYY-MM-DD');

export const inboxQuerySchema = paginationQuery(APP_PAGE_SIZE)
  .extend({
    from: civilDate.optional(),
    to: civilDate.optional(),
    q: z.string().trim().max(INBOX_SEARCH_MAX_LENGTH).optional(),
    unreadOnly: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    message: 'from must not be after to',
    path: ['to'],
  });

export const markReadBodySchema = z.object({
  ids: z.array(z.string().regex(OBJECT_ID_PATTERN)).min(1).max(MAX_READ_IDS),
});
