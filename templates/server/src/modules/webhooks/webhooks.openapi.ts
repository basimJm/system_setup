import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../constants/docs';
import { HTTP_STATUS } from '../../constants/http';
import {
  PAYMENT_WEBHOOK_ROUTE,
  WEBHOOK_PREFIX,
  WEBHOOK_SIGNATURE_HEADER,
} from '../../constants/providers';
import { errorResponses, jsonResponse, successResponseSchema } from '../../docs/schemas';
import { z } from '../../docs/zod';

export const registerPaymentWebhookDocs = (registry: OpenAPIRegistry): void => {
  registry.registerPath({
    method: 'post',
    path: `${WEBHOOK_PREFIX}${PAYMENT_WEBHOOK_ROUTE}`,
    tags: ['Webhooks'],
    summary: 'Payment gateway callback (signed; the body is gateway-specific)',
    description: `The gateway signs the exact body; the signature travels in the \`${WEBHOOK_SIGNATURE_HEADER}\` header. Unverifiable calls answer 401 and change nothing; replays are acknowledged without a second effect.`,
    request: {
      headers: z.object({ [WEBHOOK_SIGNATURE_HEADER]: z.string() }),
      body: {
        required: true,
        content: { [JSON_CONTENT_TYPE]: { schema: z.record(z.string(), z.unknown()) } },
      },
    },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse(
        'Received',
        successResponseSchema(z.object({ received: z.literal(true) })),
      ),
      ...errorResponses(HTTP_STATUS.unauthorized, HTTP_STATUS.serviceUnavailable),
    },
  });
};
