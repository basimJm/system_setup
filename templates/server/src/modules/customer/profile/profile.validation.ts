import { z } from 'zod';
import { OBJECT_KEY_MAX_LENGTH, OBJECT_KEY_PATTERN } from '../../../constants/providers';
import { emailSchema, personNameSchema } from '../../shared/auth/auth.schemas';

/** `avatarKey: null` removes the avatar. */
export const updateProfileSchema = z
  .object({
    name: personNameSchema.optional(),
    email: emailSchema.nullable().optional(),
    avatarKey: z
      .string()
      .max(OBJECT_KEY_MAX_LENGTH)
      .regex(OBJECT_KEY_PATTERN)
      .nullable()
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'nothing to update' });
