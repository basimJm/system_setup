import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { AUDIT_ROUTES } from '../../../constants/audit';
import { HTTP_STATUS } from '../../../constants/http';
import { API_PREFIXES } from '../../../constants/server';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  paginationMetaSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { auditLogsQuery } from './auditLogs.validation';

const entry = z
  .object({
    id: z.string(),
    adminId: z.string(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    before: z.unknown().optional(),
    after: z.unknown().optional(),
    reason: z.string(),
    ip: z.string(),
    userAgent: z.string(),
    createdAt: z.iso.datetime(),
  })
  .openapi('AuditLogEntry');

export const registerAdminAuditLogDocs = (registry: OpenAPIRegistry): void => {
  registry.registerPath({
    method: 'get',
    path: `${API_PREFIXES.admin}${AUDIT_ROUTES.base}`,
    tags: ['Audit'],
    summary: 'Audit log, newest first (admin, action, entity filters)',
    request: {
      headers: z.object({ 'Accept-Language': acceptLanguageHeader }),
      query: auditLogsQuery,
    },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse(
        'Entries',
        z.object({
          success: z.literal(true),
          message: z.string(),
          data: z.array(entry),
          meta: paginationMetaSchema,
        }),
      ),
      ...errorResponses(
        HTTP_STATUS.badRequest,
        HTTP_STATUS.unauthorized,
        HTTP_STATUS.forbidden,
        HTTP_STATUS.tooManyRequests,
        HTTP_STATUS.serviceUnavailable,
      ),
    },
  });
};
