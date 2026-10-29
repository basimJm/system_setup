import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { HEALTH_PATHS, HEALTH_STATUS } from '../constants/health';
import { HTTP_STATUS } from '../constants/http';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../docs/schemas';
import { z } from '../docs/zod';

const liveSchema = successResponseSchema(z.object({ status: z.literal(HEALTH_STATUS.ok) }));

const readySchema = successResponseSchema(
  z.object({
    status: z.literal(HEALTH_STATUS.ok),
    checks: z.array(
      z.object({ name: z.string(), status: z.enum([HEALTH_STATUS.up, HEALTH_STATUS.down]) }),
    ),
  }),
);

export const registerHealthDocs = (registry: OpenAPIRegistry): void => {
  registry.registerPath({
    method: 'get',
    path: HEALTH_PATHS.live,
    tags: ['Health'],
    summary: 'Liveness probe',
    description: 'The process is running. Public; does not touch any dependency.',
    request: { headers: z.object({ 'Accept-Language': acceptLanguageHeader }) },
    responses: { [HTTP_STATUS.ok]: jsonResponse('Alive', liveSchema) },
  });
  registry.registerPath({
    method: 'get',
    path: HEALTH_PATHS.ready,
    tags: ['Health'],
    summary: 'Readiness probe',
    description:
      'Every dependency check (MongoDB, Redis...) passes. Public. 503 lists the dependencies that are down.',
    request: { headers: z.object({ 'Accept-Language': acceptLanguageHeader }) },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse('Ready', readySchema),
      ...errorResponses(HTTP_STATUS.serviceUnavailable),
    },
  });
};
