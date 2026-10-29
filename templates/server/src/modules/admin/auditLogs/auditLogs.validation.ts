import { z } from 'zod';
import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ENTITY_ID_MAX_LENGTH,
  AUDIT_ENTITY_TYPE_MAX_LENGTH,
} from '../../../constants/audit';
import { OBJECT_ID_PATTERN } from '../../../constants/database';
import { ADMIN_PAGE_SIZE } from '../../../constants/pagination';
import { paginationQuery } from '../../../utils/pagination';

export const auditLogsQuery = paginationQuery(ADMIN_PAGE_SIZE).extend({
  adminId: z.string().regex(OBJECT_ID_PATTERN).optional(),
  action: z.string().max(AUDIT_ACTION_MAX_LENGTH).optional(),
  entityType: z.string().max(AUDIT_ENTITY_TYPE_MAX_LENGTH).optional(),
  entityId: z.string().max(AUDIT_ENTITY_ID_MAX_LENGTH).optional(),
});
