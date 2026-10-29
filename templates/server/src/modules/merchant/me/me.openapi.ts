import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { HTTP_STATUS } from '../../../constants/http';
import { API_PREFIXES } from '../../../constants/server';
import { MERCHANT_ME_ROUTES } from '../../../constants/team';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { memberProfileSchema } from '../auth/auth.openapi';

export const registerMerchantMeDocs = (registry: OpenAPIRegistry): void => {
  registry.registerPath({
    method: 'get',
    path: `${API_PREFIXES.merchant}${MERCHANT_ME_ROUTES.base}`,
    tags: ['Profile'],
    summary: 'My member profile and effective permissions',
    request: { headers: z.object({ 'Accept-Language': acceptLanguageHeader }) },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse('Member', successResponseSchema(memberProfileSchema)),
      ...errorResponses(
        HTTP_STATUS.unauthorized,
        HTTP_STATUS.forbidden,
        HTTP_STATUS.tooManyRequests,
        HTTP_STATUS.serviceUnavailable,
      ),
    },
  });
};
