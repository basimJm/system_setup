import type { ResponseConfig } from '@asteasolutions/zod-to-openapi';
import { ERROR_CODES, type ErrorCode } from '../constants/errorCodes';
import { LANGUAGES } from '../constants/i18n';
import { HTTP_STATUS } from '../constants/http';
import { JSON_CONTENT_TYPE } from '../constants/docs';
import { z } from './zod';

const ERROR_CODE_LIST = Object.values(ERROR_CODES) as [ErrorCode, ...ErrorCode[]];

export const errorDetailSchema = z
  .object({ field: z.string(), code: z.string(), message: z.string() })
  .openapi('ErrorDetail');

/** Base error response (CLAUDE.md §6). */
export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    message: z.string(),
    error: z.object({
      code: z.enum(ERROR_CODE_LIST),
      details: z.array(errorDetailSchema),
      traceId: z.string(),
    }),
  })
  .openapi('ErrorResponse');

export const paginationMetaSchema = z
  .object({ page: z.number().int(), pageSize: z.number().int(), total: z.number().int() })
  .openapi('PaginationMeta');

/** Base success response around a `data` schema; `meta` only for paginated lists. */
export const successResponseSchema = <T extends z.ZodType>(
  data: T,
): z.ZodObject<{
  success: z.ZodLiteral<true>;
  message: z.ZodString;
  data: T;
  meta: z.ZodOptional<typeof paginationMetaSchema>;
}> =>
  z.object({
    success: z.literal(true),
    message: z.string(),
    data,
    meta: paginationMetaSchema.optional(),
  });

export const acceptLanguageHeader = z
  .enum(LANGUAGES)
  .optional()
  .openapi({
    param: { name: 'Accept-Language', in: 'header' },
    description: 'Response language; default ar.',
  });

export const jsonResponse = (description: string, schema: z.ZodType): ResponseConfig => ({
  description,
  content: { [JSON_CONTENT_TYPE]: { schema } },
});

const ERROR_DESCRIPTIONS: Readonly<Record<number, string>> = {
  [HTTP_STATUS.badRequest]: 'Validation error',
  [HTTP_STATUS.unauthorized]: 'Missing or invalid access token',
  [HTTP_STATUS.forbidden]: 'Not allowed (token scope or permission)',
  [HTTP_STATUS.notFound]: 'Not found',
  [HTTP_STATUS.conflict]: 'Conflict with the current state',
  [HTTP_STATUS.unprocessableEntity]: 'Business rule violated',
  [HTTP_STATUS.tooManyRequests]: 'Too many requests',
  [HTTP_STATUS.internalServerError]: 'Unexpected server error',
  [HTTP_STATUS.serviceUnavailable]: 'A dependency is unavailable',
};

/** Error responses (base error envelope) for the given statuses. */
export const errorResponses = (...statuses: number[]): Record<number, ResponseConfig> =>
  Object.fromEntries(
    statuses.map((status) => [
      status,
      jsonResponse(ERROR_DESCRIPTIONS[status] ?? 'Error', errorResponseSchema),
    ]),
  );
