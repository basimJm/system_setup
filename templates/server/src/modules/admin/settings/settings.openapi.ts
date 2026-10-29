import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { HTTP_STATUS } from '../../../constants/http';
import { API_PREFIXES } from '../../../constants/server';
import { ADMIN_SETTINGS_ROUTES } from '../../../constants/settings';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { settingKeyParams, updateSettingSchema } from './settings.validation';

const entry = z
  .object({ key: z.string(), value: z.unknown(), default: z.unknown() })
  .openapi('Setting');

export const registerAdminSettingsDocs = (registry: OpenAPIRegistry): void => {
  const base = `${API_PREFIXES.admin}${ADMIN_SETTINGS_ROUTES.base}`;
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
    tags: ['Settings'],
    summary: 'Every setting with its effective value and default',
    request: { headers },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse('Settings', successResponseSchema(z.array(entry))),
      ...failures,
    },
  });
  registry.registerPath({
    method: 'put',
    path: `${base}${ADMIN_SETTINGS_ROUTES.byKey.replace(':key', '{key}')}`,
    tags: ['Settings'],
    summary:
      'Change one setting (validated by its own rule; reason required; audited; applies to every instance at once)',
    request: {
      headers,
      params: settingKeyParams,
      body: { required: true, content: { [JSON_CONTENT_TYPE]: { schema: updateSettingSchema } } },
    },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse(
        'Saved',
        successResponseSchema(z.object({ key: z.string(), value: z.unknown() })),
      ),
      ...failures,
    },
  });
};
