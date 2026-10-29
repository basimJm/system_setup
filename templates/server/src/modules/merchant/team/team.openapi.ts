import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { HTTP_STATUS } from '../../../constants/http';
import { API_PREFIXES } from '../../../constants/server';
import { TEAM_ROUTES } from '../../../constants/team';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { memberProfileSchema } from '../auth/auth.openapi';
import { addMemberSchema, memberIdParams, updateMemberSchema } from './team.validation';

export const registerMerchantTeamDocs = (registry: OpenAPIRegistry): void => {
  const base = `${API_PREFIXES.merchant}${TEAM_ROUTES.base}`;
  const headers = z.object({ 'Accept-Language': acceptLanguageHeader });
  const tags = ['Team'];
  const failures = errorResponses(
    HTTP_STATUS.badRequest,
    HTTP_STATUS.unauthorized,
    HTTP_STATUS.forbidden,
    HTTP_STATUS.notFound,
    HTTP_STATUS.conflict,
    HTTP_STATUS.tooManyRequests,
    HTTP_STATUS.serviceUnavailable,
  );
  const one = jsonResponse('Member', successResponseSchema(memberProfileSchema));
  registry.registerPath({
    method: 'get',
    path: base,
    tags,
    summary: 'Team members (owner only: 403 `OWNER_REQUIRED`)',
    request: { headers },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse(
        'Members',
        successResponseSchema(z.array(memberProfileSchema)),
      ),
      ...failures,
    },
  });
  registry.registerPath({
    method: 'post',
    path: base,
    tags,
    summary: 'Add a staff member with a permission grant (owner only)',
    description:
      'Unknown permission keys are 400; owner-only capabilities answer 400 with code `OWNER_REQUIRED` in the detail. A number already used answers 409 `PHONE_ALREADY_REGISTERED`.',
    request: {
      headers,
      body: { required: true, content: { [JSON_CONTENT_TYPE]: { schema: addMemberSchema } } },
    },
    responses: { [HTTP_STATUS.created]: one, ...failures },
  });
  registry.registerPath({
    method: 'patch',
    path: `${base}${TEAM_ROUTES.byId.replace(':id', '{id}')}`,
    tags,
    summary: 'Change a staff member (grant, name, active); changes apply at once (owner only)',
    request: {
      headers,
      params: memberIdParams,
      body: { required: true, content: { [JSON_CONTENT_TYPE]: { schema: updateMemberSchema } } },
    },
    responses: { [HTTP_STATUS.ok]: one, ...failures },
  });
};
