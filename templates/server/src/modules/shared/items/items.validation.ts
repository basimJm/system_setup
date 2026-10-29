import { z } from 'zod';
import { OBJECT_ID_PATTERN } from '../../../constants/database';
import { ITEM_OWNER_TYPES, ITEM_STATUSES } from '../../../constants/enums';
import {
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_MAX_TAGS,
  ITEM_SEARCH_MAX_LENGTH,
  ITEM_TAG_MAX_LENGTH,
  ITEM_TITLE_MAX_LENGTH,
  ITEM_TITLE_MIN_LENGTH,
} from '../../../constants/items';
import { OBJECT_KEY_MAX_LENGTH, OBJECT_KEY_PATTERN } from '../../../constants/providers';
import { AUDIT_REASON_MAX_LENGTH, AUDIT_REASON_MIN_LENGTH } from '../../../constants/audit';
import { ADMIN_PAGE_SIZE, APP_PAGE_SIZE } from '../../../constants/pagination';
import { paginationQuery } from '../../../utils/pagination';

const title = z.string().trim().min(ITEM_TITLE_MIN_LENGTH).max(ITEM_TITLE_MAX_LENGTH);
const description = z.string().trim().max(ITEM_DESCRIPTION_MAX_LENGTH);
const tag = z.string().trim().min(1).max(ITEM_TAG_MAX_LENGTH);
const imageKey = z.string().max(OBJECT_KEY_MAX_LENGTH).regex(OBJECT_KEY_PATTERN);

export const itemIdParams = z.object({ id: z.string().regex(OBJECT_ID_PATTERN) });

export const createItemSchema = z.object({
  title,
  description: description.optional(),
  tags: z.array(tag).max(ITEM_MAX_TAGS).optional(),
  imageKey: imageKey.optional(),
});

/** `imageKey: null` removes the image. */
export const updateItemSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    tags: z.array(tag).max(ITEM_MAX_TAGS).optional(),
    imageKey: imageKey.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'nothing to update' });

export const itemListQuery = paginationQuery(APP_PAGE_SIZE).extend({
  status: z.enum(ITEM_STATUSES).optional(),
  tag: tag.optional(),
  q: z.string().trim().max(ITEM_SEARCH_MAX_LENGTH).optional(),
});

export const adminItemListQuery = paginationQuery(ADMIN_PAGE_SIZE).extend({
  status: z.enum(ITEM_STATUSES).optional(),
  ownerType: z.enum(ITEM_OWNER_TYPES).optional(),
  ownerId: z.string().regex(OBJECT_ID_PATTERN).optional(),
  tag: tag.optional(),
  q: z.string().trim().max(ITEM_SEARCH_MAX_LENGTH).optional(),
});

/** Every admin write carries a reason (CLAUDE.md §5.12). */
export const adminReasonSchema = z.object({
  reason: z.string().trim().min(AUDIT_REASON_MIN_LENGTH).max(AUDIT_REASON_MAX_LENGTH),
});
