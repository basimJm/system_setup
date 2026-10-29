import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { HTTP_STATUS } from '../../../constants/http';
import { API_PREFIXES, type ApiNamespace } from '../../../constants/server';
import { UPLOAD_ROUTES } from '../../../constants/uploads';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { confirmSchema, presignSchema } from './uploads.validation';

const presigned = successResponseSchema(
  z.object({
    key: z
      .string()
      .describe('Server-generated storage key; save it in the entity after confirming.'),
    maxBytes: z.number(),
    upload: z.object({
      url: z.string(),
      method: z.literal('PUT'),
      headers: z.record(z.string(), z.string()).describe('Send these headers with the PUT.'),
      expiresAt: z.string(),
    }),
  }),
);
const confirmed = successResponseSchema(
  z.object({
    key: z.string(),
    url: z.string().nullable().describe('CDN URL; null for private files.'),
  }),
);

const failures = errorResponses(
  HTTP_STATUS.badRequest,
  HTTP_STATUS.unauthorized,
  HTTP_STATUS.forbidden,
  HTTP_STATUS.notFound,
  HTTP_STATUS.tooManyRequests,
  HTTP_STATUS.serviceUnavailable,
);

const body = (
  schema: z.ZodType,
): { required: true; content: Record<string, { schema: z.ZodType }> } => ({
  required: true,
  content: { [JSON_CONTENT_TYPE]: { schema } },
});

const registerDocs = (registry: OpenAPIRegistry, namespace: ApiNamespace): void => {
  const base = `${API_PREFIXES[namespace]}${UPLOAD_ROUTES.base}`;
  const headers = z.object({ 'Accept-Language': acceptLanguageHeader });
  const tags = ['Uploads'];
  registry.registerPath({
    method: 'post',
    path: `${base}${UPLOAD_ROUTES.presign}`,
    tags,
    summary: 'Get a presigned upload URL for a purpose (type, size and expiry are restricted)',
    request: { headers, body: body(presignSchema) },
    responses: { [HTTP_STATUS.ok]: jsonResponse('Upload target', presigned), ...failures },
  });
  registry.registerPath({
    method: 'post',
    path: `${base}${UPLOAD_ROUTES.confirm}`,
    tags,
    summary:
      'Confirm an uploaded file (real type and size are checked); rejected files are deleted',
    request: { headers, body: body(confirmSchema) },
    responses: { [HTTP_STATUS.ok]: jsonResponse('Confirmed', confirmed), ...failures },
  });
};

export const registerCustomerUploadDocs = (registry: OpenAPIRegistry): void => {
  registerDocs(registry, 'customer');
};
export const registerMerchantUploadDocs = (registry: OpenAPIRegistry): void => {
  registerDocs(registry, 'merchant');
};
export const registerAdminUploadDocs = (registry: OpenAPIRegistry): void => {
  registerDocs(registry, 'admin');
};
