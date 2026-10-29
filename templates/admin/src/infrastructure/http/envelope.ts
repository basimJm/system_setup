import { z } from 'zod';

/** Base response envelope of the server API (`{success,message,data,meta?}`). */
export const metaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type PageMeta = z.infer<typeof metaSchema>;

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.object({
    code: z.string(),
    details: z
      .array(
        z.object({
          field: z.string(),
          code: z.string().optional(),
          message: z.string().optional(),
        }),
      )
      .optional(),
    traceId: z.string().optional(),
  }),
});

export const successEnvelope = <T>(data: z.ZodType<T>) =>
  z.object({
    success: z.literal(true),
    message: z.string(),
    data,
    meta: metaSchema.optional(),
  });

export interface ApiResult<T> {
  readonly data: T;
  readonly message: string;
  readonly meta?: PageMeta;
}
