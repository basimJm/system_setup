import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { HTTP_STATUS } from '../../../constants/http';
import { NOTIFICATION_ROUTES } from '../../../constants/notifications';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  paginationMetaSchema,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { inboxQuerySchema, markReadBodySchema } from './notifications.validation';

const item = z.object({
  id: z.string(),
  type: z.string(),
  event: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.object({ itemId: z.string().optional(), deepLink: z.string().optional() }),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export const registerNotificationDocs =
  (prefix: string) =>
  (registry: OpenAPIRegistry): void => {
    const base = `${prefix}${NOTIFICATION_ROUTES.base}`;
    const headers = z.object({ 'Accept-Language': acceptLanguageHeader });
    const failures = errorResponses(
      HTTP_STATUS.badRequest,
      HTTP_STATUS.unauthorized,
      HTTP_STATUS.forbidden,
      HTTP_STATUS.tooManyRequests,
      HTTP_STATUS.serviceUnavailable,
    );
    registry.registerPath({
      method: 'get',
      path: base,
      tags: ['Notifications'],
      summary: 'Notification list, newest first, with date range, text and unread filters',
      request: { headers, query: inboxQuerySchema },
      responses: {
        [HTTP_STATUS.ok]: jsonResponse(
          'Notifications in the request language',
          z.object({
            success: z.literal(true),
            message: z.string(),
            data: z.array(item),
            meta: paginationMetaSchema,
          }),
        ),
        ...failures,
      },
    });
    registry.registerPath({
      method: 'get',
      path: `${base}${NOTIFICATION_ROUTES.unreadCount}`,
      tags: ['Notifications'],
      summary: 'Unread notifications (bell badge)',
      request: { headers },
      responses: {
        [HTTP_STATUS.ok]: jsonResponse(
          'Unread count',
          successResponseSchema(z.object({ unread: z.number().int() })),
        ),
        ...failures,
      },
    });
    registry.registerPath({
      method: 'post',
      path: `${base}${NOTIFICATION_ROUTES.read}`,
      tags: ['Notifications'],
      summary: 'Mark own notifications as read (idempotent; unknown or foreign ids are ignored)',
      request: {
        headers,
        body: { content: { [JSON_CONTENT_TYPE]: { schema: markReadBodySchema } } },
      },
      responses: {
        [HTTP_STATUS.ok]: jsonResponse(
          'Newly marked and remaining unread',
          successResponseSchema(z.object({ marked: z.number().int(), unread: z.number().int() })),
        ),
        ...failures,
      },
    });
  };
