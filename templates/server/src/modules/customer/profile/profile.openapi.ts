import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { HTTP_STATUS } from '../../../constants/http';
import { API_PREFIXES } from '../../../constants/server';
import { CUSTOMER_PROFILE_ROUTES } from '../../../constants/team';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { customerProfileSchema } from '../auth/auth.openapi';
import { updateProfileSchema } from './profile.validation';

export const registerCustomerProfileDocs = (registry: OpenAPIRegistry): void => {
  const path = `${API_PREFIXES.customer}${CUSTOMER_PROFILE_ROUTES.base}`;
  const headers = z.object({ 'Accept-Language': acceptLanguageHeader });
  const ok = jsonResponse('Profile', successResponseSchema(customerProfileSchema));
  const failures = errorResponses(
    HTTP_STATUS.badRequest,
    HTTP_STATUS.unauthorized,
    HTTP_STATUS.forbidden,
    HTTP_STATUS.tooManyRequests,
    HTTP_STATUS.serviceUnavailable,
  );
  registry.registerPath({
    method: 'get',
    path,
    tags: ['Profile'],
    summary: 'My profile',
    request: { headers },
    responses: { [HTTP_STATUS.ok]: ok, ...failures },
  });
  registry.registerPath({
    method: 'patch',
    path,
    tags: ['Profile'],
    summary: 'Change my name, email or avatar (`null` removes email / avatar)',
    request: {
      headers,
      body: { required: true, content: { [JSON_CONTENT_TYPE]: { schema: updateProfileSchema } } },
    },
    responses: { [HTTP_STATUS.ok]: ok, ...failures },
  });
};
