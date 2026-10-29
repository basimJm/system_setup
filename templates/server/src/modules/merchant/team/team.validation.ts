import { z } from 'zod';
import { OBJECT_ID_PATTERN } from '../../../constants/database';
import { PERMISSIONS } from '../../../constants/enums';
import { personNameSchema, phoneSchema } from '../../shared/auth/auth.schemas';

/** Longest accepted permission name; unknown names are refused by the service with a detail. */
const PERMISSION_KEY_MAX_LENGTH = 40;
const permissions = z.array(z.string().max(PERMISSION_KEY_MAX_LENGTH)).max(PERMISSIONS.length);

export const memberIdParams = z.object({ id: z.string().regex(OBJECT_ID_PATTERN) });
export const addMemberSchema = z.object({
  name: personNameSchema,
  phone: phoneSchema,
  permissions,
});
export const updateMemberSchema = z
  .object({
    name: personNameSchema.optional(),
    permissions: permissions.optional(),
    active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'nothing to update' });
