import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { ITEM_OWNER_TYPES, ITEM_STATUSES } from '../../../constants/enums';
import { HTTP_STATUS } from '../../../constants/http';
import { ITEM_ROUTES } from '../../../constants/items';
import { API_PREFIXES, type ApiNamespace } from '../../../constants/server';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  paginationMetaSchema,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import {
  adminItemListQuery,
  adminReasonSchema,
  createItemSchema,
  itemIdParams,
  itemListQuery,
  updateItemSchema,
} from './items.validation';

const itemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()),
    imageUrl: z.string().nullable(),
    status: z.enum(ITEM_STATUSES),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Item');

const adminItemSchema = itemSchema
  .extend({
    owner: z.object({ type: z.enum(ITEM_OWNER_TYPES), id: z.string() }),
    archivedReason: z.string().optional(),
    archivedAt: z.iso.datetime().optional(),
  })
  .openapi('AdminItem');

const pathToDoc = (route: string): string => route.replace(/:(\w+)/g, '{$1}');
const headers = z.object({ 'Accept-Language': acceptLanguageHeader });
const body = (
  schema: z.ZodType,
): { required: true; content: Record<string, { schema: z.ZodType }> } => ({
  required: true,
  content: { [JSON_CONTENT_TYPE]: { schema } },
});
const list = (item: z.ZodType): z.ZodType =>
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(item),
    meta: paginationMetaSchema,
  });
const failures = errorResponses(
  HTTP_STATUS.badRequest,
  HTTP_STATUS.unauthorized,
  HTTP_STATUS.forbidden,
  HTTP_STATUS.notFound,
  HTTP_STATUS.unprocessableEntity,
  HTTP_STATUS.tooManyRequests,
  HTTP_STATUS.serviceUnavailable,
);

const registerOwnerDocs = (registry: OpenAPIRegistry, namespace: ApiNamespace): void => {
  const base = `${API_PREFIXES[namespace]}${ITEM_ROUTES.base}`;
  const tags = ['Items'];
  const one = jsonResponse('Item', successResponseSchema(itemSchema));
  registry.registerPath({
    method: 'get',
    path: base,
    tags,
    summary: 'My items, newest first (status, tag and title filters)',
    request: { headers, query: itemListQuery },
    responses: { [HTTP_STATUS.ok]: jsonResponse('Items', list(itemSchema)), ...failures },
  });
  registry.registerPath({
    method: 'post',
    path: base,
    tags,
    summary: 'Create an item',
    description:
      'At most `items.maxPerOwner` active items (422 `ITEM_LIMIT_REACHED`). `imageKey` must be a confirmed `ITEM_IMAGE` upload of this owner.',
    request: { headers, body: body(createItemSchema) },
    responses: { [HTTP_STATUS.created]: one, ...failures },
  });
  registry.registerPath({
    method: 'get',
    path: `${base}${pathToDoc(ITEM_ROUTES.byId)}`,
    tags,
    summary: 'One of my items',
    request: { headers, params: itemIdParams },
    responses: { [HTTP_STATUS.ok]: one, ...failures },
  });
  registry.registerPath({
    method: 'patch',
    path: `${base}${pathToDoc(ITEM_ROUTES.byId)}`,
    tags,
    summary: 'Change an item (archived items are read-only: 422 `ITEM_ARCHIVED`)',
    request: { headers, params: itemIdParams, body: body(updateItemSchema) },
    responses: { [HTTP_STATUS.ok]: one, ...failures },
  });
  registry.registerPath({
    method: 'post',
    path: `${base}${pathToDoc(ITEM_ROUTES.archive)}`,
    tags,
    summary: 'Archive an item (soft delete)',
    request: { headers, params: itemIdParams },
    responses: { [HTTP_STATUS.ok]: one, ...failures },
  });
};

export const registerCustomerItemDocs = (registry: OpenAPIRegistry): void => {
  registerOwnerDocs(registry, 'customer');
};
export const registerMerchantItemDocs = (registry: OpenAPIRegistry): void => {
  registerOwnerDocs(registry, 'merchant');
};

export const registerAdminItemDocs = (registry: OpenAPIRegistry): void => {
  const base = `${API_PREFIXES.admin}${ITEM_ROUTES.base}`;
  const tags = ['Items'];
  const one = jsonResponse('Item', successResponseSchema(adminItemSchema));
  registry.registerPath({
    method: 'get',
    path: base,
    tags,
    summary: 'All items (owner, status, tag and title filters)',
    request: { headers, query: adminItemListQuery },
    responses: { [HTTP_STATUS.ok]: jsonResponse('Items', list(adminItemSchema)), ...failures },
  });
  registry.registerPath({
    method: 'get',
    path: `${base}${pathToDoc(ITEM_ROUTES.byId)}`,
    tags,
    summary: 'One item with its owner',
    request: { headers, params: itemIdParams },
    responses: { [HTTP_STATUS.ok]: one, ...failures },
  });
  registry.registerPath({
    method: 'post',
    path: `${base}${pathToDoc(ITEM_ROUTES.archive)}`,
    tags,
    summary: 'Archive an item with a reason (audit log + owner notification)',
    request: { headers, params: itemIdParams, body: body(adminReasonSchema) },
    responses: { [HTTP_STATUS.ok]: one, ...failures },
  });
  registry.registerPath({
    method: 'post',
    path: `${base}${pathToDoc(ITEM_ROUTES.restore)}`,
    tags,
    summary: 'Restore an archived item with a reason (audit log + owner notification)',
    request: { headers, params: itemIdParams, body: body(adminReasonSchema) },
    responses: { [HTTP_STATUS.ok]: one, ...failures },
  });
};
